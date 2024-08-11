// import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
// import fs from "fs"
// import ffmpeg from "ffmpeg";
// import path from "path";

const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const fsp = require("fs/promises");
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
ffmpeg.setFfmpegPath(ffmpegPath);

const s3client = new S3Client({
    region: "ap-south-1",
    credentials: {
        accessKeyId: "",
        secretAccessKey: "",
    },
});

const RESOLUTIONS = [
    {
        resolution: "360p",
        width: 640,
        height: 360,
    },
    {
        resolution: "480p",
        width: 854,
        height: 480,
    },
    {
        resolution: "720p",
        width: 1280,
        height: 720,
    }
];

const bucketName = process.env.BUCKET_NAME
const downloadFileName = process.env.DOWNLOAD_FILE_NAME

async function init() {

    // DOWLOAD ORIGINAL VIDEO

    try {
        console.log("bucketName: ", bucketName);
        console.log("downloadFileName: ", downloadFileName);
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: downloadFileName,
        });
        const result = await s3client.send(command);
        const tempVideoPath = "tempVideo.mp4";
        fsp.writeFile(tempVideoPath, result.Body);
        const tempVideoFile = path.resolve(tempVideoPath);

        console.log("Video downloaded successfully");

        // TRANSCODE VIDEO
        const promises = RESOLUTIONS.map((resolution) => {
            return new Promise((resolve, reject) => {
                try {
                    const { width, height } = resolution;
                    const output = `${downloadFileName}_${resolution.resolution}.mp4`;
                    console.log(`Transcoding video to ${resolution.resolution} resolution`);

                    
                    
                    
                    ffmpeg(tempVideoFile)
                        .output(output)
                        .withSize(`${width}x${height}`)
                        .withVideoCodec('libx264')
                        .withAudioCodec('aac')
                        .format('mp4')
                        .on('end', async function (stdout, stderr) {
                            console.log('Transcoding succeeded, now uploading !');
                            const command = new PutObjectCommand({
                                Bucket: "rjnitt-output-video",
                                Key: `${output}`,
                                Body: fs.createReadStream(output)
                            });
                            await s3client.send(command);
                            console.log("transcoded video upload to new bucket finished");
                            resolve(output);
                        })
                        .run()
                        ;

                } catch (e) {
                    console.log(e.code);
                    console.log(e.msg);
                }
            });
        });
        await Promise.all(promises);


    } catch (error) {
        console.log("Error downloading video: ", error);
    }
}

init().finally(() => {
    console.log("Transcoding completed");
    process.exit(0);
});
