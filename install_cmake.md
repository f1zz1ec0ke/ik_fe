# CMake Installation Guide

The build process requires CMake to be installed. Here are several ways to install CMake on Windows:

## Option 1: Direct Download (Recommended)
1. Visit https://cmake.org/download/
2. Download the Windows x64 Installer
3. Run the installer and make sure to check "Add CMake to system PATH"

## Option 2: Visual Studio Installer
1. Open Visual Studio Installer
2. Modify your Visual Studio installation
3. Under "Individual components", search for "CMake"
4. Install "C++ CMake tools for Visual Studio"

## Option 3: Chocolatey
If you have Chocolatey installed:
```
choco install cmake
```

## Option 4: winget
If you have winget (Windows Package Manager):
```
winget install Kitware.CMake
```

## Verify Installation
After installation, restart your command prompt and verify:
```
cmake --version
```

You should see output similar to:
```
cmake version 3.27.0
```

## Troubleshooting
- If CMake is not recognized after installation, restart your command prompt or IDE
- Make sure CMake is added to your system PATH environment variable
- You may need to restart your computer after installation