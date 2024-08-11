import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs"

const client = new SQSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});

const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});

const config = {
  CLUSTER_DEFINITION:
    "arn:aws:ecs:ap-south-1:590183753846:cluster/video-encoder",
  TASK_DEFINITION:
    "arn:aws:ecs:ap-south-1:590183753846:task-definition/video-encoder-ecs-task",
    
};


const receiveMessageCommand = new ReceiveMessageCommand({
  QueueUrl: "https://sqs.ap-south-1.amazonaws.com/590183753846/S3TestingQueue",
  MaxNumberOfMessages: 1,
  WaitTimeSeconds: 20,
});

async function init() {

  while (true) {

    const { Messages } = await client.send(receiveMessageCommand);
    console.log(Messages);
    if (!Messages) {
      console.log("No messages in the queue");
      continue;
    }

    try {
      for (const message of Messages) {
        const { Body, MessageId } = message;
        console.log("Message recieved: ", { Body, MessageId });


        // validate & event 
        // {
        //     Body: '{"Records":[{"eventVersion":"2.1","eventSource":"aws:s3","awsRegion":"ap-south-1","eventTime":"2024-07-24T16:59:30.597Z","eventName":"ObjectCreated:Put","userIdentity":{"principalId":"A3DSM5K7BIS5UX"},"requestParameters":{"sourceIPAddress":"122.161.48.149"},"responseElements":{"x-amz-request-id":"A84C3C26RW7FXM27","x-amz-id-2":"NXr2XiinnCKwSbrtWZo6tQvFPFYOux/30PrsxrWtaNhVEVaCLbtqFFss1R2WyL07JYsVtCrMjuXlYHvPOyHXETGiIk48V7Xm"},"s3":{"s3SchemaVersion":"1.0","configurationId":"SQS Event ","bucket":{"name":"rjnitt-vercel","ownerIdentity":{"principalId":"A3DSM5K7BIS5UX"},"arn":"arn:aws:s3:::rjnitt-vercel"},"object":{"key":"file_example_MP4_480_1_5MG.mp4","size":1570024,"eTag":"d9061d3da8601932e98f79ec8ba1c877","sequencer":"0066A132F2687962E2"}}}]}',
        //     MessageId: '11c3907c-4655-48ec-96b6-4ead1a437e32'
        //   }
        if (!Body) continue;
        let event;
        try {
          event = JSON.parse(Body);
          console.log("JSON Event: ", event);
        } catch (error) {
          console.log("Error parsing JSON body:", error);
          await deleteSQSMessage(message.ReceiptHandle??"");      
          continue;
        }


        

        // {"Service":"Amazon S3","Event":"s3:TestEvent","Time":"2024-07-24T16:56:57.011Z","Bucket":"rjnitt-vercel","RequestId":"K92SSGD7C7H326Q4","HostId":"lKo9VCFGlXtmhkSHhoLW4SCz3nodXktmrtB0C57DF7ldL4RJ/7iiGgPXYbljumamTaq2IpZnD1w="}
        if (event.Event === "s3:TestEvent") {
          console.log("Test event recieved");
          await deleteSQSMessage(message.ReceiptHandle??"");
          continue;
        }

        // spin up container
        for (const record of event.Records) {
          const { eventName, s3 } = record;
          const { bucket, object } = s3;
          const { name } = bucket;
          const { key } = object;
          console.log(" REcord Event: ", { eventName, bucket: name, object: key });
          await createTask(name, key);
        }

        await deleteSQSMessage(message.ReceiptHandle??"");

        // remove event from queue
      }
    } catch (error) {
      console.log("Error processing message: ", error);
    }

  }
}
async function deleteSQSMessage(receiptHandle: string) {
  console.log("Deleting message with receipt handle: ", receiptHandle);
  const deleteMessage = new DeleteMessageCommand({
    QueueUrl: "https://sqs.ap-south-1.amazonaws.com/590183753846/S3TestingQueue",
    ReceiptHandle: receiptHandle,
  });
  await client.send(deleteMessage);
}

// async function createTask(bucketName: string, filename: string) {
//   const command = new RunTaskCommand({
//     cluster: config.CLUSTER_DEFINITION,
//     taskDefinition: config.TASK_DEFINITION,
//     launchType: "FARGATE",
//     count: 1,
//     networkConfiguration: {
//       awsvpcConfiguration: {
//         assignPublicIp: "ENABLED",
//         subnets: [
//           "subnet-0359423292fa3049b",
//           "subnet-0bfc5f11a0da7facf",
//           "subnet-05fa2093585962655",
//         ],
//         securityGroups: ["sg-0bd804ba2a04e3528"],
//       },
//     },
//     overrides: {
//       containerOverrides: [
//         {
//           name: "video-encoder-ecr",
//           environment: [
//             {
//               name: "BUCKET_NAME",
//               value: bucketName,
//             },
//             {
//               name: "DOWNLOAD_FILE_NAME",
//               value: filename,
//             },
//           ],
//         },
//       ],
//     },
//   });
//   const data = await ecsClient.send(command);
//  console.log("Task created successfully:", data.tasks);
// }
const createTask = async (bucketName: string, filename: string) => {
  const command = new RunTaskCommand({
    cluster: config.CLUSTER_DEFINITION,
    taskDefinition: config.TASK_DEFINITION,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: [
          "subnet-0359423292fa3049b",
          "subnet-0bfc5f11a0da7facf",
          "subnet-05fa2093585962655",
        ],
        securityGroups: ["sg-0bd804ba2a04e3528"],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "video-encoder-ecr",
          environment: [
            {
              name: "BUCKET_NAME",
              value: bucketName,
            },
            {
              name: "DOWNLOAD_FILE_NAME",
              value: filename,
            },
          ],
        },
      ],
    },
  });

  try {
    //   const command = new RunTaskCommand(params);
    const data = await ecsClient.send(command);
    console.log("Task created successfully:", data.tasks);
  } catch (error) {
    console.error("Error creating task:", error);
  }
};

init();