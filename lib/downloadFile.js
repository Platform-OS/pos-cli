const fs = require('fs'),
    https = require('https');

module.exports = (url, fileName) => {
    return new Promise((resolve, reject) => {
        let file = fs.createWriteStream(fileName).on('close', () => resolve());
        https.get(url, response => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            }).on('error', reject);
        });
    });
}
