# 4Runr Gateway Spike Test

This project is designed to perform spike testing and health sampling against the 4Runr Gateway using k6. It includes scripts for running tests, sampling health metrics, and calculating metric deltas.

## Project Structure

```
4Runr-Gateway-Spike-Test
├── src
│   ├── tests
│   │   ├── spike-test.js        # k6 script for spike testing
│   │   └── health-sampling.js   # script for health sampling
│   └── utils
│       └── helpers.js           # utility functions
├── k6-config
│   ├── spike-test-config.json    # configuration for spike test
│   └── health-sampling-config.json # configuration for health sampling
├── package.json                  # npm configuration
├── README.md                     # project documentation
└── .gitignore                    # files to ignore in Git
```

## Getting Started

### Prerequisites

- Node.js and npm installed on your machine.
- k6 installed for running performance tests.

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd 4Runr-Gateway-Spike-Test
   ```

2. Install dependencies:
   ```
   npm install
   ```

### Running Tests

- To run the spike test:
  ```
  k6 run src/tests/spike-test.js
  ```

- To sample health metrics:
  ```
  node src/tests/health-sampling.js
  ```

### Metrics Calculation

After running the spike test, you can calculate the delta in metrics by executing:
```
node src/utils/metrics-delta.js
```

### Health Sampling

The health sampler runs every 15 seconds for approximately 15 minutes, capturing the status of the health and readiness endpoints. Results are written to a CSV file for analysis.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.

## License

This project is licensed under the MIT License.