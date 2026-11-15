# `training` — From-Scratch ~20M PyTorch Language Model

Repo: [github.com/eosterloh/training](https://github.com/eosterloh/training) · September 2026 · Python, PyTorch, DGX Spark.

From-scratch ~20M-parameter language model pretraining stack on DGX Spark (`h=384, L=10, i=1152, 8 heads`) trained on **FineWeb-Edu** with a fresh 32k BPE tokenizer.

- Every core block is written by hand as `nn.Module`s (`RMSNorm`, `RoPE`, causal attention, `SwiGLU`, residual connections, MoE router + load-balance loss) without `transformers.LlamaForCausalLM` or `nn.MultiheadAttention`.
- Controlled architecture ablations on an identical token budget and seed: dense `MHA → GQA → MQA → sliding-window attention → top-2 MoE`, tracking validation loss from chance (`~10.4`) down below `5.0` (`~4.5` target).
