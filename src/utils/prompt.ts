
export async function prompt( what: string = ">> "): Promise<string>
{
    return new Promise((resolve, reject) => {
        process.stdin.resume();
        process.stdout.write( what );

        process.stdin.once('data', data => {
            resolve(data.toString().trim());
            process.stdin.pause()
        });
        process.stdin.once('error', err => reject(err));
    });
}