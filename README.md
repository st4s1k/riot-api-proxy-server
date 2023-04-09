# Riot API Proxy Server

A Cloudflare Worker that acts as a proxy server for the Riot Games API, managing rate limits and caching for better performance.

## Features

-   Rate limiting for both clients and the server itself
-   Caching successful API responses
-   Extracting and setting the region for API requests
-   Automatic handling of Riot API rate limits

## Installation

1. Ensure you have Node.js, npm, and the Cloudflare Wrangler CLI installed on your system.
2. Clone the repository and navigate to the project folder:

    ```sh
    git clone https://github.com/st4s1k/riot-api-proxy-server.git
    cd riot-api-proxy-server
    ```

3. Install the dependencies:

    ```sh
    npm install
    ```

4. Configure the wrangler.toml file with your Cloudflare account ID and the appropriate API key.
5. Add your Riot Games API key as an environment variable in your Cloudflare Worker:

    ```sh
    wrangler secret put API_KEY
    ```

## Usage

1. Install dependencies:

    ```sh
    npm install
    ```

2. Build the project:

    ```sh
    npm run build
    ```

    This command will compile TypeScript files and output the result to the `dist` directory.

3. Run the project in development mode:

    ```sh
    npm run start
    ```

    This command will start the development server with live reloading, which will automatically recompile and restart the application when changes are detected.

4. Deploy the project:

    ```sh
    npm run deploy
    ```

    This command will deploy your application to Cloudflare Workers.

5. View real-time logs:

    ```sh
    npm run tail
    ```

    This command will display real-time logs from your Cloudflare Worker application.

6. Run tests:

    ```sh
    npm test
    ```

    This command will run the tests using Jest.

7. Run tests silently:

    ```sh
    npm run test:silent
    ```

    This command will run the tests using Jest without console output.

8. Run tests with logs output to a file in `./logs/` directory:

    ```sh
    npm run test:log
    ```

    This command will run the tests and save the output to a log file located in the logs directory. The log file will be named with the format YYYY-MM-DD_HH-mm-ss.log.

## Configuration

The worker configuration can be modified through environment variables or `vars` section in the `wrangler.toml` file:

-   `DEFAULT_REGION`: Default region for Riot API requests (default: "euw1")
-   `CACHE_DURATION`: Cache duration in seconds (0 to disable) (default: 3600)
-   `RATE_LIMIT_INTERVAL`: Rate limit interval in seconds (default: 60)
-   `RATE_LIMIT_BURST`: Rate limit burst (max requests per interval) (default: 100)

## License

This project is released under the MIT License. See the [LICENSE](LICENSE) file for details.
