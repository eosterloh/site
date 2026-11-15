# Resume

**Erick Osterloh** · Colorado Springs, CO · [eosterloh@gmail.com](mailto:eosterloh@gmail.com) · [github.com/eosterloh](https://github.com/eosterloh) · [linkedin.com/in/erickosterloh](https://linkedin.com/in/erickosterloh)

Formatted resume: [Google Doc](https://docs.google.com/document/d/15MY6QCvS4CCGUiHNE69p0wiBzFfXLg8SUr_zQ_u6FnM/edit?tab=t.4ddqfndbcge8)

## Education

**Colorado College**, Colorado Springs, CO — Aug 2024–May 2028  
B.A. Computer Science, GPA 3.8. Fall 2026 study abroad in Copenhagen.  
Courses: Data Structures and Algorithms, Applied Python, Software Design, Computer Organization, Discrete Math, Linear Algebra.

**Coursera** — Jan 2026: Machine Learning Specialization (Andrew Ng).

## Experience

**Google** — Software Engineering Intern · Agents, Databases, C++, SQL · May–Aug 2026
- Debugging dashboard for the conversion-uploads pipeline; SQL aggregation script cut dashboard latency ~95%.
- Agentic insights workflow over analytical databases: automatic analysis for ~2.1M customers / ~3.5B conversions daily.
- Customer-issue agent for root-cause analysis over petabyte-scale data: multi-agent architecture for planning, investigating, and reasoning; cut investigation time ~75%.
- Bugs + team productivity: populating DB fields, Conduit features, team-specific coding skills, and setting up the team code-reviewer agent.

**PayNearMe** — AI/Software Engineering Intern · RAG, Evals, Python · May–Jul 2025
- Built RAG pipelines on LlamaIndex; improved retrieval performance +67% via reranking and query rephrasing.
- Wrote evals system with RAGAS + Arize Phoenix (tracing, observability, and evaluation metrics to pinpoint pipeline improvements).
- Completed ~20 product tickets: payment debugging, UI updates, and order-adjustment scripts.

## Projects (selected)

- **TinyTrains RSI / Auto-research harness** (Jul–Aug 2026): Long-running agent harness for an 8M-parameter Llama-style model (`Eval → Research → Train`) on TinyStories under a 3.5-day budget. Research runs in a sandbox; promotion is gated on a frozen holdout eval (`confirm_ppl`) the agent does not control. [github.com/eosterloh/lab](https://github.com/eosterloh/lab)
- **Inference engine (`infer`)** (Python/CUDA, Jul–Aug 2026): Plug-and-play local inference engine for agents — drop in `config.json` + weights, get tokens out with greedy-decode parity on HuggingFace logits, JSON-schema constrained decoding, and custom CUDA kernels. Enables agents to swap architectures across RSI and training runs. [github.com/eosterloh/infer](https://github.com/eosterloh/infer)
- **MCP personal server** (Python, Jul 2026): Personal MCP server giving any MCP-capable agent grounded context split into public and private slices (private requires access tokens).
- **Golf swing detection CNN** (Java/Python/TensorFlow/Android, Oct 2025–Jan 2026): Convolutional Neural Network trained on Erick's golf swing over 10M+ accelerometer, gyroscope, and heart-rate time-series sensor points from a Pixel Watch. [github.com/eosterloh/WearOSJava](https://github.com/eosterloh/WearOSJava)

## Skills

Languages: Python, C++, Java, C, JavaScript, Go (plus SQL and Ruby on Rails).  
Applied: Agents, harnesses, RAG, PyTorch, TensorFlow, deep learning, CUDA / inference optimization, Android development, databases.
