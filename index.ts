import * as apigateway from "@pulumi/aws-apigateway";
import * as aws from "@pulumi/aws";
import { Runtime } from "@pulumi/aws/lambda";

const eventHandler = new aws.lambda.CallbackFunction("handler", {
    runtime: Runtime.NodeJS18dX,
    callback: async () => {
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Hello from API Gateway!",
            }),
        };
    },
    tags: {
        "Owner": "Neo",
    },
});

const endpoint = new apigateway.RestAPI("api", {
    routes: [
        {
            path: "/source",
            method: "GET",
            eventHandler,
        },
        {
            path: "/",
            localPath: "www",
        },
    ],
    tags: {
        "Owner": "Neo",
    },
});


// Export the public URL for the HTTP service
export const url = endpoint.url;
