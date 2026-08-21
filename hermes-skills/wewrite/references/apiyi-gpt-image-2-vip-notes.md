# ApiYi gpt-image-2-vip notes for WeWrite image workflows

Session source: API易 docs + live test on 2026-07-04.

## Current integration choice

Use ApiYi `gpt-image-2-vip` through:

```bash
python3 /root/.hermes/skills/productivity/wewrite/scripts/image_gen.py \
  --prompt '<explicit ratio + scene + style prompt>' \
  --output '<local image path>'
```

The shared config is `/root/.hermes/workspace/wewrite/config.yaml`; ApiYi provider should be:

```yaml
provider: apiyi
base_url: https://api.apiyi.com/v1
endpoint: /images/generations
model: gpt-image-2-vip
api_key_env: APIYI_API_KEY
response_format: auto
size: "auto"
```

## Important API quirks

- Endpoint: `POST https://api.apiyi.com/v1/images/generations`.
- Typical latency: roughly 90-150s per docs; one test image returned in ~67s.
- Default response can be `b64_json`; `b64_json` already includes `data:image/png;base64,` when returned by the API. Code should handle both `url` and `b64_json`.
- Returned URL, when present, is temporary; download to local storage before publishing.
- Do not send `quality`.
- Do not send `n`; docs warn `n` is unsupported and can cause extra billing without extra outputs.
- The docs warn `size` may be temporarily ineffective. Use `size: "auto"` and put aspect ratio in the prompt: `[2.35:1]` for WeChat covers, `[16:9]` for article body illustrations, `[3:4]` for sticker/newspic infographics.

## Production prompt rules for 峰峰's WeChat workflows

- Use 新海诚系电影感日系动漫画风 with concrete visual traits: transparent low-to-medium saturation sky, soft airy color grading, huge clouds, golden/blue hour, volumetric light, backlight, lens flare, rain/glass/water reflection, detailed city/nature background, clear air, cinematic composition.
- Covers and article body illustrations should usually say `不要文字，不要水印`.
- Sticker infographics currently use direct T2I complete Chinese infographic generation; audit text visually and regenerate on pseudo-Chinese or typos.
- Do not use `image_generate` as the first choice for these workflows; the user specifically selected ApiYi `gpt-image-2-vip`.

## Live test result

Prompted a `[3:4]` Chinese AI-tools infographic. Result:

- model: `gpt-image-2-vip`
- endpoint: `/v1/images/generations`
- response kind: `b64_json`
- dimensions: `1086 x 1448`
- elapsed: `66.92s`
- Chinese text: readable Simplified Chinese, no visible pseudo-Chinese in the tested title/cards/footer.

Conclusion: good enough for formal replacement, with continued per-image text/ratio QA.