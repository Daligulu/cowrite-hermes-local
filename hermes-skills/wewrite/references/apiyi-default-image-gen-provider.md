# ApiYi `gpt-image-2-vip` as Default Image Generation Backend

Session learning: when 峰峰 asks to “设置生图默认走 apiyi 的 gpt-image2-vip 模型”, handle both layers:

1. **WeWrite/workflow configs** — make ApiYi the only enabled provider in YAML image configs.
   - Set provider `apiyi` to `enabled: true`.
   - Set `model: gpt-image-2-vip` (hyphenated ID verified in this environment).
   - Set `base_url: https://api.apiyi.com/v1`, `endpoint: /images/generations`, `api_key_env: APIYI_API_KEY`, `response_format: auto`, `size: auto`.
   - Set Doubao or other image providers to `enabled: false` unless 峰峰 explicitly allows fallback.
   - Update all workflow image config YAMLs, not only `/root/.hermes/workspace/wewrite/config.yaml`.

2. **Hermes `image_generate` tool default** — add/select an image-gen provider plugin if Hermes does not already ship ApiYi.
   - User plugin path: `/root/.hermes/plugins/image_gen/apiyi/`.
   - Manifest: `plugin.yaml` with `kind: backend` and `requires_env: [APIYI_API_KEY]`.
   - Provider class should subclass `agent.image_gen_provider.ImageGenProvider`, register via `ctx.register_image_gen_provider(...)`, call ApiYi’s OpenAI-compatible `/images/generations`, decode `b64_json` or URL responses, and save final images under Hermes cache using `save_b64_image` / `save_url_image`.
   - Config keys:
     ```yaml
     plugins:
       enabled:
         - apiyi
     image_gen:
       provider: apiyi
       model: gpt-image-2-vip
       apiyi:
         model: gpt-image-2-vip
         base_url: https://api.apiyi.com/v1
         endpoint: /images/generations
         api_key_env: APIYI_API_KEY
         response_format: auto
         size: auto
         timeout: 300
     ```

3. **Verification pattern**
   - Dry-run WeWrite script and every workflow config: each should show exactly `[('apiyi', 'gpt-image-2-vip', True)]` for enabled providers.
   - Compile both plugin and WeWrite script with `py_compile`.
   - Run one real small generation and report provider/model/response kind/file size/elapsed time. This confirms the key and model actually work.
   - Run `hermes config check` after config changes.

4. **Documentation cleanup**
   - Patch `wewrite/SKILL.md` so it no longer claims “ApiYi + Doubao parallel race” as the normal default. Doubao is a manual fallback only.
   - Explain to the user that current-session tool descriptions may still show the previous image backend because tool schemas are cached at session start; new sessions/cron jobs read the new config.

Do not save raw secrets. Do not capture transient authentication/setup failures as permanent constraints.