const request = require('request');
export default function (uri: string, options: any): Promise<any> {
    return new Promise((resolve, reject) => {
        request(uri, options, (error:any, response:any) => {
            if (error) return reject(error);
            if (response.statusCode !== 200) return reject(response.statusMessage);
            resolve(response.body);
        });
    });
}