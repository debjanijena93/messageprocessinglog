const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const mime = require('mime-types'); // for content-type lookup

const cds = require('@sap/cds');
const axios = require('axios');
const AWS = require('aws-sdk');
const qs = require('qs');
require('dotenv').config();

const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

let awsAccessKey = `${process.env.AWS_ACCESS_KEY}`
let awsSecretAccessKey = `${process.env.AWS_SECRET_ACCESS_KEY}`
let s3Bucket = `${process.env.S3_BUCKET}`

let allResult
let objectMessageGuid

const s3 = new S3Client({
    region: "eu-north-1",
    credentials: {
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretAccessKey
    }
})

// Helper: Convert stream to string
const streamToString = async (stream) => {
    return await new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}

const streamToBuffer = async (stream) => {
    return await new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
}


async function getBTPAccessToken() {
    try {

        const response = await axios.post(`${process.env.TOKEN_URL}`, data, {
            auth: {
                username: `${process.env.CLIENT_ID}`,
                password: `${process.env.CLIENT_SECRET}`
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error.response?.data || error.message);
        throw error;
    }
}

function formatMsDate(msDateString) {
    const timestamp = parseInt(msDateString.match(/\d+/)[0], 10);
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

async function getAPIResponse(apiURL, destination) {

    try {
        /*const accessToken = await getBTPAccessToken();

        const response = await axios.get(apiURL, {
            headers: {
                //Authorization: `Basic ${Buffer.from(`${process.env.BTP_IS_USER}:${process.env.BTP_IS_PASS}`).toString('base64')}`,
                Authorization: 'Bearer ' + accessToken,
                Accept: 'application/json',
            },
        });
        
        console.log("inside function: ", response.data);
        */
        const response = await executeHttpRequest(
            { destinationName: destination },
            {
                method: 'GET',
                url: apiURL,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return response;

    } catch (error) {
        console.log("Error fetching data using API:", error);
    }
}

async function uploadInS3(log, filePath, fileName) {

    try {
        const s3 = new AWS.S3({
            accessKeyId: awsAccessKey,
            secretAccessKey: awsSecretAccessKey,
        });


        const content = JSON.stringify(log, null, 2);
        const key = filePath + fileName;
        const params = {
            Bucket: s3Bucket,
            Key: key,
            Body: content,
            ContentType: 'application/json',
        };
        await s3.upload(params).promise();
        //console.log(`File ${fileName} uploaded successfully at ${s3Bucket}/${filePath}`);

    } catch (error) {
        console.log('failed to upload - ', error);
    }

}

async function fetchMPLAndUploadInS3(destination) {

    try {

        //var messageLogAPI = `/api/v1/MessageProcessingLogs?$filter=IntegrationFlowName eq 'TEST_Example_V2'`;
        var messageLogAPI = '/api/v1/MessageProcessingLogs';
        var response = await getAPIResponse(messageLogAPI, destination);
        var output = response.data.d.results;


        const mainlog = [];
        //Loop for individual record
        for (const [index, entry] of output.entries()) {
            try {

                //fetch Error information for FAILED status

                if (entry.Status === 'FAILED') {
                    //messageLogAPI = `${process.env.BTP_IS_URL}` + `/api/v1/MessageProcessingLogErrorInformations('` + `${entry.MessageGuid}` + `')/$value`;
                    messageLogAPI = `/api/v1/MessageProcessingLogErrorInformations('` + `${entry.MessageGuid}` + `')/$value`;
                    response = await getAPIResponse(messageLogAPI, destination);
                    const errorInfo = response?.data;
                    entry.ErrorInfoMessage = errorInfo;
                    //console.log("Error information:", errorInfo);
                }


                var date = formatMsDate(entry.LogStart);
                var filePath = `Innoverv/Innoverv-Dev/${date.substring(6, 10)}/${date.substring(3, 5)}/${date.substring(0, 2)}/${entry.IntegrationArtifact?.Name}/${entry.MessageGuid}/`;
                var fileName = `${entry.MessageGuid}.json`;
                mainlog.push({
                    globalAccount: "Innoverv",
                    subAccount: "Innoverv-Dev",
                    date: entry.LogStart,
                    formattedDate: date,
                    iFlowName: entry.IntegrationArtifact?.Name,
                    status: entry.Status,
                    messageGuid: entry.MessageGuid,
                    filePath: filePath,
                })




                // upload individual json file
                await uploadInS3(entry, filePath, fileName);

                // fetch attachment for each record
                //messageLogAPI = `${process.env.BTP_IS_URL}` + `/api/v1/MessageProcessingLogs('` + `${entry.MessageGuid}` + `')/Attachments`;
                messageLogAPI = `/api/v1/MessageProcessingLogs('` + `${entry.MessageGuid}` + `')/Attachments`;
                response = await getAPIResponse(messageLogAPI, destination);
                const attachmentLog = response.data.d.results;
                if (attachmentLog?.length > 0) {
                    //console.log("-----------------------------------------------------")
                    filePath = filePath + 'Attachments/';
                    fileName = `${entry.MessageGuid}_AttachmentLog.json`;
                    // upload attachment log for each record
                    await uploadInS3(attachmentLog, filePath, fileName);
                    for (const [index, attachment] of attachmentLog.entries()) {
                        //messageLogAPI = attachment.__metadata.media_src;
                        messageLogAPI = `api/v1/MessageProcessingLogAttachments('` + attachment.Id + `')/$value`
                        response = await getAPIResponse(messageLogAPI, destination);
                        const attachmentData = response.data;
                        fileName = attachment.Name;
                        // upload each attachment for a record
                        await uploadInS3(attachmentData, filePath, fileName);
                    }
                }



            } catch (error) {
                console.log("inside loop error:", error);
            }
        }
        const integrationMasterLog = {
            messagelog: mainlog
        }

        filePath = '';
        fileName = "integration-message-log-master-data.json";
        await uploadInS3(integrationMasterLog, filePath, fileName);

        console.log('Logs uploaded to S3 successfully.');
        return { message: 'Logs uploaded to S3 successfully.' };

    } catch (error) {
        console.error('Error--------------------------------------------------------:', error);
        return { error: 'Failed to fetch or upload logs.' };
    }
}

async function fetchFromS3(key) {


    const bucket = "messageprocessinglog";
    var key = key;
    try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const response = await s3.send(command);
        const jsonStr = await streamToString(response.Body);
        const jsonData = JSON.parse(jsonStr);

        return jsonData;

    } catch (err) {
        console.error("Error fetching data from S3:", err);
        return [];
    }

}

function extractMultiFilters(whereClause) {
    const filters = {};

    function processClause(clause) {
        if (!Array.isArray(clause)) return;

        for (let i = 0; i < clause.length; i++) {
            const item = clause[i];

            // If nested xpr
            if (item && typeof item === 'object' && item.xpr) {
                processClause(item.xpr);
                continue;
            }

            // Look for a pattern: {ref}, '=', {val}
            if (
                item && typeof item === 'object' && item.ref &&
                clause[i + 1] === '=' &&
                clause[i + 2] && typeof clause[i + 2] === 'object' && clause[i + 2].val !== undefined
            ) {
                const field = item.ref[0];
                const value = clause[i + 2].val;

                if (!filters[field]) {
                    filters[field] = [];
                }

                if (!filters[field].includes(value)) {
                    filters[field].push(value);
                }

                i += 2; // skip '=', {val}
            }
        }
    }

    processClause(whereClause);
    return filters;
}


function mapMessageLog(jsonData, req) {

    var where = req?.query?.SELECT?.where;
    var messageLog = jsonData?.messagelog;
    var result;
    //Applyfilters
    if (where) {

        var filter = extractMultiFilters(where);

        messageLog = messageLog.filter(item =>
            filter?.globalAccount.includes(item.globalAccount) &&
            filter?.status.includes(item.status)
        );

    }

    if (messageLog) {
        // Convert JSON array to result format
        result = messageLog.map((item, index) => ({
            iflowName: item.iFlowName,
            messageGuid: item.messageGuid,
            status: item.status,
            statusCriticality: item.status === 'COMPLETED' ? 3
                : item.status === 'FAILED' ? 1
                    : 0,
            date: formatMsDate(item.date),
            globalAccount: item.globalAccount,
            subAccount: item.subAccount,
            filePath: item.filePath,
        }));
    }
    return result;

}

function calculateProcessingTime(start, end) {
    //console.log(start);
    const timestampStart = parseInt(start.match(/\d+/)[0], 10);
    const timestampEnd = parseInt(end.match(/\d+/)[0], 10);

    var ms = timestampStart - timestampEnd;
    //console.log(ms);

    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    var time = '';

    if (hours > 0) {
        time += `${hours}h `;
    }
    if (minutes > 0 || hours > 0) { // Only show minutes if hours are present or minutes are non-zero
        time += `${minutes}m `;
    }
    if (seconds > 0 || hours > 0 || minutes > 0) { // Only show seconds if hours or minutes are present, or seconds are non-zero
        time += `${seconds}s `;
    }

    time += `${milliseconds}ms`; // Always show milliseconds
    //console.log("time", time.trim);
    return time;
}

module.exports = cds.service.impl(async function (srv) {

    srv.on('READ', 'S3JsonData', async (req) => {

        objectMessageGuid = '';
        const statusTextMap = {
            COMPLETED: 'Message processing completed successfully.',
            FAILED: 'Message processing failed.'
        }

        var result;
        var key;
        if (req.query?.SELECT?.from?.ref?.[0]?.where?.[0]?.ref?.[0] === 'messageGuid') {
            // going to object page

            objectMessageGuid = req.query.SELECT.from.ref[0].where[2].val;
            result = allResult?.filter(item => item.messageGuid === objectMessageGuid);

            if (result) {
                const hasToDetailsColumn = req.query?.SELECT?.columns?.some(
                    col => col.ref?.[0] === 'to_Details'
                );

                if (hasToDetailsColumn) {

                    key = result?.[0].filePath + result?.[0].messageGuid + '.json';
                    var jsonDataObjectDetails = await fetchFromS3(key);


                    result[0].to_Details = {
                        correlationID: jsonDataObjectDetails.CorrelationId,
                        statusText: statusTextMap[result[0].status] || 'unknown',
                        iflowName: jsonDataObjectDetails?.IntegrationArtifact?.Name,
                        iflowID: jsonDataObjectDetails?.IntegrationArtifact?.Id,
                        type: jsonDataObjectDetails?.IntegrationArtifact?.Type,
                        package: jsonDataObjectDetails?.IntegrationArtifact?.PackageName,
                        processingTime: calculateProcessingTime(jsonDataObjectDetails?.LogEnd, jsonDataObjectDetails?.LogStart)
                    };
                }

                const hasToAttachmentColumn = req.query?.SELECT?.columns?.some(
                    col => col.ref?.[0] === 'to_Attachments'
                );

                if (hasToAttachmentColumn) {

                    key = result?.[0].filePath + 'Attachments/' + result?.[0].messageGuid + '_AttachmentLog';
                    var jsonDataAttachmentDetails = await fetchFromS3(key);
                    var to_Attachments;
                    var i = 0;
                    result[0].to_Attachments = [];
                    for (const [index, attachment] of jsonDataAttachmentDetails.entries()) {

                        result[0].to_Attachments[i] = {
                            fileName: attachment.Name,
                            fileType: attachment.ContentType,
                            date: formatMsDate(attachment.TimeStamp),
                            size: attachment.PayloadSize,
                            filePath: result[0].filePath,
                        }
                        i++;
                    }

                }

            }

        } else {
            // fetching data for list report page
            key = "integration-message-log-master-data.json";
            var jsonData = await fetchFromS3(key);
            result = mapMessageLog(jsonData, req);
            allResult = result;
        };

        return result;
    });

    srv.on('READ', 'S3Attachment', async (req) => {
        objectMessageGuid = '';
        objectMessageGuid = req?.query?.SELECT?.from?.ref?.[0].where?.[2]?.val;
        result = allResult?.filter(item => item.messageGuid === objectMessageGuid);
        if (result) {
            try {

                key = result?.[0].filePath + 'Attachments/' + result?.[0].messageGuid + '_AttachmentLog';
                var jsonDataAttachmentDetails = await fetchFromS3(key);

                var to_Attachments;
                to_Attachments = jsonDataAttachmentDetails?.map((item, index) => ({
                    fileName: item.Name,
                    fileType: item.ContentType,
                    size: item.PayloadSize,
                    date: formatMsDate(item.TimeStamp),
                    filePath: result[0].filePath,
                }));

            } catch (error) {

            }

            return to_Attachments;
        }
    })

    srv.on('READ', 'S3JsonObject', async (req) => {
        var a;
    });

    srv.on('READ', 'statusVH', async () => {
        const key = "statusTexts.json";
        try {
            const statusRecords = await fetchFromS3(key);

            const result = statusRecords.status.map((item) => ({
                id: item.id,
                text: item.text,
            }));
            return result

        } catch (err) {
            console.error("Error fetching data from S3:", err);
            return [];
        }

    });

    srv.on('READ', 'subAccountVH', async (req) => {

        const key = "btpAccounts.json";
        const globalAccount = req?.query?.SELECT?.where?.[2].val;

        try {
            const subAccounts = await fetchFromS3(key);
            //     console.log("Sub account code getting called", subAccounts);

            const result = subAccounts.btpAccounts.map((item) => ({
                globalAccount: item.globalAccount,
                subAccount: item.subAccount,
            }));

            //            console.log("Global account is - ", req.query.SELECT.where[2].val)
            if (globalAccount) {
                //              console.log("inside sub account filter - ")
                return result.filter(acc => acc.globalAccount === globalAccount);

            }
            return result

        } catch (err) {
            console.error("Error fetching data from S3:", err);
            return [];
        }

    });

    srv.on('READ', 'globalAccountVH', async () => {

        const key = "btpAccounts.json";
        try {
            const globalAccounts = await fetchFromS3(key);
            //            console.log("Global account code getting called", globalAccounts);

            const result = globalAccounts.btpAccounts.map((item) => ({
                globalAccount: item.globalAccount,
            }));
            return result

        } catch (err) {
            console.error("Error fetching data from S3:", err);
            return [];
        }

    });


    srv.on('reads3file', async (req) => {
        console.log(" READ_S3_FILE action called");
        const { filePath } = req.data;
        console.log("file path:", filePath);

        try {
            const bucket = "messageprocessinglog";
            var key = filePath;
            //key = 'Innoverv/Innoverv-Dev/2025/05/13/TEST_Example_V2/AGgi8F-G9TF-cHAfX6KY9S_oR9r2/'
            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            const response = await s3.send(command);
            const fileBuffer = await streamToBuffer(response.Body);
            const base64Content = fileBuffer.toString('base64');
            //const contentType = mime.lookup(filePath) || 'application/octet-stream';
            const contentType = mime.lookup(filePath) || 'text/plain';
            return {
                fileName: filePath,
                contentType,
                base64Content
            };
        } catch (err) {
            console.error("S3 read error:", err);
            req.reject(500, "Failed to read S3 file1");
        }

    });

    this.on('fetchLogsAndUpload', async (req) => {
        var destination = req.data.destination;

        await fetchMPLAndUploadInS3(destination);

    });

    this.on('updateSubaccountDestination', async (req) => {

        const key = "btpAccounts.json";
        const dataFromS3 = await fetchFromS3(key);
        const destinations = dataFromS3.btpAccounts || [];

        const { globalAccount, subAccount, destination, isActive } = req.data;

        let found = false;

        // Search for matching entry
        for (let entry of destinations) {
            if (
                entry.globalAccount === globalAccount &&
                entry.subAccount === subAccount &&
                entry.destination === destination
            ) {
                // Update existing entry
                entry.isActive = isActive;
                found = true;
                break;
            }
        }

        // If not found, add new entry
        if (!found) {
            destinations.push({
                globalAccount,
                subAccount,
                destination,
                isActive
            });
        }

        // Prepare final object and upload
        const updatedData = { btpAccounts: destinations };

        console.log("Updated destinations: ", JSON.stringify(updatedData, null, 2));

        await uploadInS3(updatedData, '', key);
    })

    /*cds.spawn({ every: 1 * 30 * 1000 }, async () => {
        console.log("Running in every 5 minutes.")
        await fetchMPLAndUploadInS3();
    })*/


});

