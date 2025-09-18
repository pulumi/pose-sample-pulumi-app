import * as apigateway from "@pulumi/aws-apigateway";
import * as aws from "@pulumi/aws";
import { Runtime } from "@pulumi/aws/lambda";

const eventHandler = new aws.lambda.CallbackFunction("handler", {
    runtime: Runtime.NodeJS20dX,
    callback: async () => {
        // Collection of dad jokes
        const dadJokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "Why did the scarecrow win an award? He was outstanding in his field!",
            "Why don't eggs tell jokes? They'd crack each other up!",
            "I told my wife she was drawing her eyebrows too high. She looked surprised!",
            "Why can't a bicycle stand up by itself? It's two tired!",
            "What do you call a fake noodle? An impasta!",
            "Want to hear a construction joke? Oh never mind, I'm still working on that one!",
            "Why did the coffee file a police report? It got mugged!",
            "How do you organize a space party? You planet!",
            "Why did the math book look so sad? Because of all of its problems!",
            "What do you call cheese that isn't yours? Nacho cheese!",
            "Why couldn't the leopard play hide and seek? Because he was always spotted!",
            "What do you call a bear with no teeth? A gummy bear!",
            "Why did the cookie go to the doctor? Because it felt crumbly!",
            "How does a penguin build its house? Igloos it together!",
            "Why don't skeletons fight each other? They don't have the guts!",
            "What did the grape do when he got stepped on? Nothing but let out a little wine!",
            "I used to hate facial hair... but then it grew on me!",
            "What do you call a dinosaur that crashes his car? Tyrannosaurus Wrecks!",
            "Why can't your nose be 12 inches long? Because then it would be a foot!"
        ];
        
        // Select a random dad joke
        const randomJoke = dadJokes[Math.floor(Math.random() * dadJokes.length)];
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                joke: randomJoke,
                timestamp: new Date().toISOString(),
            }),
        };
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
});


// Export the public URL for the HTTP service
export const url = endpoint.url;
