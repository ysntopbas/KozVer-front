const webpack = require('webpack');

module.exports = {
    webpack: {
        configure: {
            resolve: {
                fallback: {
                    process: require.resolve("process/browser"),
                    buffer: require.resolve("buffer/"),
                }
            },
            plugins: [
                new webpack.ProvidePlugin({
                    process: 'process/browser',
                    Buffer: ['buffer', 'Buffer'],
                }),
            ],
        },
    },
}; 