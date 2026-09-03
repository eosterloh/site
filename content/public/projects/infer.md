# infer — DIY hybrid decoder

Mac path: `~/Projects/infer`. From-scratch inference: HuggingFace folder (`config.json` + safetensors) → logits → greedy tokens.

Recipes in flight: Llama, Mistral, Qwen2/3, Yi, Gemma, Phi-3, Mixtral, Llama 4, GPT-2, GPT-NeoX, GPT-OSS, DeepSeek V3, Nemotron-H. North star: **Nemotron NVFP4 fused on DGX Spark**, agent-runnable.

Pass 1 is a readable Llama path (`engine/chat.py` → generate_greedy). Pass 2 is hybrid schedule (Mamba / MoE). Spark run: `python -m engine.chat --model … --device cuda`.
