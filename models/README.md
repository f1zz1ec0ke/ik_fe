# Models Directory

This directory is for storing GGUF model files that can be used with the ik_llama.cpp web interface.

## Usage

1. Place your `.gguf` model files in this directory or create subdirectories for organization
2. The web interface will automatically discover all `.gguf` files recursively
3. Models in subdirectories will be displayed with their parent folder name for better organization

## Supported Formats

- `.gguf` files (GGML Universal Format)

## Organization

You can organize your models in subdirectories like:
```
models/
├── 7b/
│   ├── model1.gguf
│   └── model2.gguf
├── 13b/
│   └── large-model.gguf
└── small-model.gguf
```

Models in subdirectories will be displayed as "7b/model1.gguf" in the interface.

## Download Sources

Popular sources for GGUF models:
- Hugging Face (search for models with "GGUF" in the name)
- TheBloke's quantized models
- Official model repositories

Make sure to download models that are compatible with your hardware specifications.