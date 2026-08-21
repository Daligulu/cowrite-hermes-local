import importlib.util
import multiprocessing as mp
import os
import stat
import subprocess
import sys
import time
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_DIR / 'scripts'


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'cannot load {path}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_custom_payload_is_the_default_and_keeps_official_filters():
    mod = load_module('byted_web_search', SCRIPTS / 'web_search.py')
    body = mod.build_body(
        query='人工智能最新政策',
        count=7,
        time_range='OneWeek',
        auth_level=1,
        query_rewrite=True,
    )
    assert body == {
        'Query': '人工智能最新政策',
        'SearchType': 'web',
        'Count': 7,
        'NeedSummary': True,
        'Filter': {'AuthInfoLevel': 1},
        'TimeRange': 'OneWeek',
        'QueryControl': {'QueryRewrite': True},
    }
    assert mod.INTERNAL_API_URL.endswith('/search_api/web_search')


def test_hermes_env_loader_reads_only_hermes_home(tmp_path, monkeypatch):
    mod = load_module('byted_web_search_env', SCRIPTS / 'web_search.py')
    hermes_home = tmp_path / 'hermes'
    openclaw_home = tmp_path / 'openclaw'
    hermes_home.mkdir()
    openclaw_home.mkdir()
    (hermes_home / '.env').write_text('WEB_SEARCH_API_KEY=hermes-key\n', encoding='utf-8')
    (openclaw_home / '.env').write_text('WEB_SEARCH_API_KEY=openclaw-key\n', encoding='utf-8')
    monkeypatch.setenv('HERMES_HOME', str(hermes_home))
    monkeypatch.delenv('WEB_SEARCH_API_KEY', raising=False)
    mod.load_hermes_env()
    assert os.environ['WEB_SEARCH_API_KEY'] == 'hermes-key'


def test_configure_key_preserves_other_values_and_never_returns_secret(tmp_path):
    mod = load_module('configure_key', SCRIPTS / 'configure_key.py')
    env_path = tmp_path / '.env'
    env_path.write_text('OTHER=value\nWEB_SEARCH_API_KEY=old\n', encoding='utf-8')
    result = mod.upsert_env_value(env_path, 'WEB_SEARCH_API_KEY', 'new-secret')
    text = env_path.read_text(encoding='utf-8')
    assert 'OTHER=value' in text
    assert 'WEB_SEARCH_API_KEY=new-secret' in text
    assert 'old' not in text
    assert 'new-secret' not in result
    assert stat.S_IMODE(env_path.stat().st_mode) == 0o600


def _rate_worker(script: str, state_path: str, output_path: str):
    code = (
        "import importlib.util,time;"
        f"s=importlib.util.spec_from_file_location('rl',r'{script}');"
        "m=importlib.util.module_from_spec(s);s.loader.exec_module(m);"
        f"m.FileRateLimiter(r'{state_path}',qps=4).acquire();"
        f"open(r'{output_path}','w').write(str(time.time()))"
    )
    subprocess.run([sys.executable, '-c', code], check=True)


def test_rate_limiter_serializes_independent_processes_at_four_qps(tmp_path):
    script = str(SCRIPTS / 'rate_limit.py')
    state = str(tmp_path / 'rate.state')
    outputs = [str(tmp_path / f'{i}.txt') for i in range(4)]
    procs = [mp.Process(target=_rate_worker, args=(script, state, out)) for out in outputs]
    start = time.monotonic()
    for proc in procs:
        proc.start()
    for proc in procs:
        proc.join(10)
        assert proc.exitcode == 0
    elapsed = time.monotonic() - start
    stamps = sorted(float(Path(p).read_text()) for p in outputs)
    assert elapsed >= 0.65
    assert all((b - a) >= 0.20 for a, b in zip(stamps, stamps[1:]))


def test_cli_missing_key_is_safe_and_does_not_recommend_chat_paste(tmp_path):
    env = os.environ.copy()
    env['HERMES_HOME'] = str(tmp_path / 'hermes')
    for key in ('WEB_SEARCH_API_KEY', 'WEB_SEARCH_CUSTOM_API_KEY', 'WEB_SEARCH_GLOBAL_API_KEY', 'VOLCENGINE_ACCESS_KEY', 'VOLCENGINE_SECRET_KEY'):
        env.pop(key, None)
    proc = subprocess.run(
        [sys.executable, str(SCRIPTS / 'web_search.py'), '测试'],
        env=env,
        text=True,
        capture_output=True,
        timeout=10,
    )
    assert proc.returncode == 1
    assert '未找到凭证' in proc.stderr
    assert 'configure_key.py' in proc.stderr


def test_global_payload_and_endpoint_are_distinct_from_custom():
    mod = load_module('byted_web_search_global', SCRIPTS / 'web_search.py')
    body = mod.build_global_body('中国人工智能政策', count=6, snippet_length=800, image_count=0)
    assert body == {
        'Query': '中国人工智能政策',
        'DocCount': 6,
        'MaxSnippetLength': 800,
        'MaxImageCountPerDoc': 0,
    }
    assert mod.GLOBAL_API_URL.endswith('/search_api/global_search')
    assert mod.GLOBAL_API_URL != mod.CUSTOM_API_URL


def test_version_specific_credentials_do_not_cross_fallback(monkeypatch):
    mod = load_module('byted_web_search_credentials', SCRIPTS / 'web_search.py')
    monkeypatch.setenv('WEB_SEARCH_CUSTOM_API_KEY', 'custom-key')
    monkeypatch.setenv('WEB_SEARCH_GLOBAL_API_KEY', 'global-key')
    monkeypatch.setenv('WEB_SEARCH_API_KEY', 'legacy-key')
    assert mod.get_api_key('custom') == 'custom-key'
    assert mod.get_api_key('global') == 'global-key'
    monkeypatch.delenv('WEB_SEARCH_GLOBAL_API_KEY')
    assert mod.get_api_key('global') is None


def test_global_output_contains_traceable_titles_and_urls():
    mod = load_module('byted_web_search_global_output', SCRIPTS / 'web_search.py')
    data = {
        'Result': {
            'TotalDocCount': 1,
            'Documents': [{
                'Rank': 0,
                'Title': '官方政策',
                'Url': 'https://example.gov.cn/policy',
                'Snippet': [{'Type': 'text', 'Text': '政策正文摘要'}],
                'DocumentInfo': {'PublishTime': '2026-07-29', 'ContentTokenCount': 123},
                'HostInfo': {'Hostname': 'example.gov.cn'},
            }],
        }
    }
    text = mod.format_output(data, 'web', version='global')
    assert '返回数: 1' in text
    assert '官方政策' in text
    assert 'https://example.gov.cn/policy' in text
    assert '政策正文摘要' in text
    assert '2026-07-29' in text
    assert '123 tokens' in text


def test_custom_and_global_use_separate_rate_limit_state(monkeypatch, tmp_path):
    mod = load_module('rate_limit_versions', SCRIPTS / 'rate_limit.py')
    monkeypatch.setenv('HERMES_HOME', str(tmp_path))
    custom = mod.default_state_path('custom')
    global_path = mod.default_state_path('global')
    assert custom != global_path
    assert custom.name == 'rate-limit-custom.state'
    assert global_path.name == 'rate-limit-global.state'
