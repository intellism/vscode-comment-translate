import * as request from 'request';
export default function (uri: string, options: request.CoreOptions): Promise<any> {
    return new Promise((resolve, reject) => {
        request(uri, options, (error, response) => {
            if (error) return reject(error);
            if (response.statusCode !== 200) return reject(response.statusMessage);
            resolve(response.body);
        });
    });
}