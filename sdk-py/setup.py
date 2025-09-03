from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="runrgateway",
    version="1.0.0",
    author="4Runr Team",
    author_email="team@4runr.com",
    description="Official SDK for 4Runr Gateway - Secure API proxy with built-in authentication, policy enforcement, and resilience",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/4runr/gateway-sdk-py",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Security",
        "Topic :: Internet :: WWW/HTTP :: HTTP Servers",
    ],
    python_requires=">=3.10",
    install_requires=[
        "httpx>=0.24.0",
        "pydantic>=2.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "isort>=5.12.0",
            "mypy>=1.0.0",
        ]
    },
    keywords="4runr, gateway, api, proxy, security, authentication, policy, resilience",
    project_urls={
        "Bug Reports": "https://github.com/4runr/gateway-sdk-py/issues",
        "Source": "https://github.com/4runr/gateway-sdk-py",
        "Documentation": "https://github.com/4runr/gateway-sdk-py#readme",
    },
)
