const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require('mime-types'); // for content-type lookup

const cds = require('@sap/cds');
require('dotenv').config();

const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

let awsAccessKey, awsSecretAccessKey, awsRegion, s3Bucket, batchjobInterval;
if (cds.env.production == false) {
    awsAccessKey = `${process.env.AWS_ACCESS_KEY}`
    awsSecretAccessKey = `${process.env.AWS_SECRET_ACCESS_KEY}`
    awsRegion = `${process.env.AWS_REGION}`
    s3Bucket = `${process.env.S3_BUCKET}`
    batchjobInterval = `${process.env.BATCHJOB_INTERVAL}`

} else if (JSON.parse(process.env.VCAP_SERVICES)['user-provided'] != undefined) {
    let credentials = JSON.parse(process.env.VCAP_SERVICES)['user-provided'][0].credentials;
    awsAccessKey = credentials.awsAccessKey;
    awsSecretAccessKey = credentials.awsSecretAccessKey;
    awsRegion = credentials.awsRegion;
    s3Bucket = credentials.s3Bucket;
    batchjobInterval = credentials.batchjobInterval
}

let allResult;
let objectMessageGuid;
let startBatchJob = '';

let tenantFileName = 'BTP_TENANTS.json', 
    masterLogFileName = 'integration-message-log-master-data.json',
    statusTextFileName = 'statusTexts.json';


if (awsAccessKey) {
    var awsS3Client = new S3Client({
        region: awsRegion,
        credentials: {
            accessKeyId: awsAccessKey,
            secretAccessKey: awsSecretAccessKey
        }
    })
}

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

async function readDestination() {

    const key = tenantFileName;
    const dataFromS3 = await fetchFromS3(key);
    const destinations = dataFromS3.btpAccounts || [];

    return destinations;
}

async function uploadDestinations(destinations) {

    // Prepare final object and upload
    const key = tenantFileName;
    const updatedData = { btpAccounts: destinations };
    await uploadInS3(updatedData, '', key);


}

function formatMsDate(msDateString) {
    const timestamp = parseInt(msDateString.match(/\d+/)[0], 10);
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatDateIntoISOFormat(msDateString) {

    // Extract the number using regex or string functions
    const timestamp = parseInt(msDateString.match(/\d+/)[0], 10);

    const date = new Date(timestamp);

    // Format to ISO string (e.g., 2025-05-22T00:00:00Z)
    const isoString = date.toISOString();

    const cleanDateTimeStamp = isoString.split('.')[0]; // "2024-05-01T00:00:00"
    return cleanDateTimeStamp;
}

async function getAPIResponse(apiURL, destination) {

    try {
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
        const content = JSON.stringify(log, null, 2);
        const key = filePath + fileName;
        const params = {
            Bucket: s3Bucket,
            Key: key,
            Body: content,
            ContentType: 'application/json',
        };

        const command = new PutObjectCommand(params);
        await awsS3Client.send(command);

    } catch (error) {
        console.log('failed to upload - ', error);
    }

}

async function fetchMPLAndUploadInS3(req) {

    try {

        var mainlog = [];
        var lastRunDateTime;
        var currentDateTimeISO;
        var startDate, endDate;
        var tenants = [];
        key = masterLogFileName;
        var jsonData = await fetchFromS3(key);
        if (jsonData?.messagelog) {
            var existingMessagelog = jsonData.messagelog.map((item, index) => ({
                messageGuid: item.messageGuid,
                status: item.status,
                date: item.date,
                globalAccount: item.globalAccount,
                subAccount: item.subAccount,
                iFlowName: item.iFlowName,
                filePath: item.filePath,
            }));

            lastRunDateTime = jsonData?.lastRunDateTime;
            mainlog = existingMessagelog;
        } else {

        }


        if (!req) {

            var currentTime = new Date();
            var currentDateTime = currentTime.getTime();
            currentDateTimeISO = formatDateIntoISOFormat(currentDateTime);

            if (lastRunDateTime) {
                startDate = lastRunDateTime
                endDate = currentDateTimeISO
            } else {

            }
            tenants = await readDestination();
        } else {
            startDate = req.data.startDate + 'T00:00:00';
            endDate = req.data.endDate + 'T00:00:00';

            tenants = [{
                globalAccount: req.data.globalAccount,
                subAccount: req.data.subAccount,
                destination: req.data.destination,
                isActive: 'X'
            }]

        }

        var newUpdate = '';

        for (const [index_dest, tenant] of tenants.entries()) {

            var messageLogAPI = `api/v1/MessageProcessingLogs?$filter=LogStart ge datetime'${startDate}' and LogStart le datetime'${endDate}'`
            var response = await getAPIResponse(messageLogAPI, tenant.destination);
            var output = response.data.d.results;

            //Loop for individual record
            for (const [index, entry] of output.entries()) {
                try {

                    var exists = '';
                    exists = mainlog.some(log => log.messageGuid === entry.MessageGuid);
                    if (exists) continue; // Skip this entry if it already exists

                    //fetch Error information for FAILED status
                    newUpdate = 'X';
                    if (entry.Status === 'FAILED') {
                        messageLogAPI = `/api/v1/MessageProcessingLogErrorInformations('` + `${entry.MessageGuid}` + `')/$value`;
                        response = await getAPIResponse(messageLogAPI, tenant.destination);
                        const errorInfo = response?.data;
                        entry.ErrorInfoMessage = errorInfo;
                    }


                    var date = formatMsDate(entry.LogStart);
                    var filePath = `${tenant.globalAccount}/${tenant.subAccount}/${date.substring(6, 10)}/${date.substring(3, 5)}/${date.substring(0, 2)}/${entry.IntegrationArtifact?.Name}/${entry.MessageGuid}/`;
                    var fileName = `${entry.MessageGuid}.json`;
                    mainlog.push({
                        globalAccount: tenant.globalAccount,
                        subAccount: tenant.subAccount,
                        date: entry.LogStart,
                        iFlowName: entry.IntegrationArtifact?.Name,
                        status: entry.Status,
                        messageGuid: entry.MessageGuid,
                        filePath: filePath,
                    })


                    // upload individual json file
                    await uploadInS3(entry, filePath, fileName);

                    // fetch attachment for each record
                    messageLogAPI = `/api/v1/MessageProcessingLogs('` + `${entry.MessageGuid}` + `')/Attachments`;
                    response = await getAPIResponse(messageLogAPI, tenant.destination);
                    const attachmentLog = response.data.d.results;
                    if (attachmentLog?.length > 0) {
                        filePath = filePath + 'Attachments/';
                        fileName = `${entry.MessageGuid}_AttachmentLog.json`;
                        // upload attachment log for each record
                        await uploadInS3(attachmentLog, filePath, fileName);
                        for (const [index, attachment] of attachmentLog.entries()) {
                            messageLogAPI = `api/v1/MessageProcessingLogAttachments('` + attachment.Id + `')/$value`
                            response = await getAPIResponse(messageLogAPI, tenant.destination);
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
        }

        if (newUpdate === 'X') {
            const integrationMasterLog = {
                lastRunDateTime: endDate,
                messagelog: mainlog,
            }

            filePath = '';
            fileName = masterLogFileName;
            await uploadInS3(integrationMasterLog, filePath, fileName);

            console.log('Logs uploaded to S3 successfully.');
            return { message: 'Logs uploaded to S3 successfully.' };
        } else {
            return { message: 'No new entry to update' };
        }
    } catch (error) {
        console.error('Error--------------------------------------------------------:', error);
        return { error: 'Failed to fetch or upload logs.' };
    }
}

async function fetchFromS3(key) {


    var key = key;
    try {
        const command = new GetObjectCommand({ Bucket: s3Bucket, Key: key });
        const response = await awsS3Client.send(command);
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


function filterAndMapMessageLog(jsonData, req) {

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
            iFlowName: item.iFlowName,
            messageGuid: item.messageGuid,
            status: item.status,
            statusCriticality: item.status === 'COMPLETED' ? 3
                : item.status === 'FAILED' ? 1
                    : 0,
            date: formatDateIntoISOFormat(item.date),
            globalAccount: item.globalAccount,
            subAccount: item.subAccount,
            filePath: item.filePath,
        }));

    }
    return result;

}

function calculateProcessingTime(start, end) {

    const timestampStart = parseInt(start.match(/\d+/)[0], 10);
    const timestampEnd = parseInt(end.match(/\d+/)[0], 10);

    var ms = timestampStart - timestampEnd;

    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    var time = '';

    if (hours > 0) {
        time += `${hours}h `;
    }
    if (minutes > 0 || hours > 0) { 
        time += `${minutes}m `;
    }
    if (seconds > 0 || hours > 0 || minutes > 0) { 
        time += `${seconds}s `;
    }

    time += `${milliseconds}ms`; 
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
                        iFlowName: jsonDataObjectDetails?.IntegrationArtifact?.Name,
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
                            date: formatDateIntoISOFormat(attachment.TimeStamp),
                            size: attachment.PayloadSize,
                            filePath: result[0].filePath,
                        }
                        i++;
                    }

                }

            }

        } else {
            // fetching data for list report page
            key = masterLogFileName;
            var jsonData = await fetchFromS3(key);
            result = filterAndMapMessageLog(jsonData, req);
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

                key = result?.[0].filePath + 'Attachments/' + result?.[0].messageGuid + '_AttachmentLog.json';
                var jsonDataAttachmentDetails = await fetchFromS3(key);

                var to_Attachments;
                to_Attachments = jsonDataAttachmentDetails?.map((item, index) => ({
                    fileName: item.Name,
                    fileType: item.ContentType,
                    size: item.PayloadSize,
                    date: formatDateIntoISOFormat(item.TimeStamp),
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
        const key = statusTextFileName;
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

        const key = tenantFileName;
        const globalAccount = req?.query?.SELECT?.where?.[2].val;

        try {
            const subAccounts = await fetchFromS3(key);

            const result = subAccounts.btpAccounts.map((item) => ({
                globalAccount: item.globalAccount,
                subAccount: item.subAccount,
            }));

            if (globalAccount) {
                return result.filter(acc => acc.globalAccount === globalAccount);
            }
            return result

        } catch (err) {
            console.error("Error fetching data from S3:", err);
            return [];
        }

    });

    srv.on('READ', 'globalAccountVH', async () => {

        const key = tenantFileName;
        try {
            const globalAccounts = await fetchFromS3(key);

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
            var key = filePath;
            const command = new GetObjectCommand({ Bucket: s3Bucket, Key: key });
            const response = await awsS3Client.send(command);
            const fileBuffer = await streamToBuffer(response.Body);
            const base64Content = fileBuffer.toString('base64');
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

    srv.on('fetchLogsAndUpload', async (req) => {
        await fetchMPLAndUploadInS3(req);
    });

    srv.on('addDestination', async (req) => {

        var destinations = await readDestination();

        const count = destinations.filter(dest => dest.isActive === 'X').length;

        if (count === 5) {
            req.error(404, '5 active destination already exists. Please deactivate one to add a new destination');
        } else {
            const found = destinations.some(entry =>
                entry.globalAccount === req.data.globalAccount &&
                entry.subAccount === req.data.subAccount &&
                entry.isActive === 'X');

            if (found) {
                req.error(404, 'One active destination already exists for the BTP Global and sub account');
            } else {
                destinations.push(
                    {
                        globalAccount: req.data.globalAccount,
                        subAccount: req.data.subAccount,
                        destination: req.data.destination,
                        isActive: 'X'
                    }
                )
            }
        }
        await uploadDestinations(destinations)
        return { message: 'Destination added successfully!' }

    })

    srv.on('deactivateDestination', async (req) => {

        const destinations = await readDestination();

        const foundIndex = destinations.findIndex(entry =>
            entry.globalAccount === req.data.globalAccount &&
            entry.subAccount === req.data.subAccount &&
            entry.destination === req.data.destination);

        if (foundIndex !== -1) {
            destinations[foundIndex].isActive = req.data.deactivate;
        } else {
            req.error(404, ' No such destination found for the BTP Global Account and Sub Account');
        }

        await uploadDestinations(destinations);
        return { message: 'Deactivated successfully!' }
    })

    srv.on('READ', 'destinations', async (req) => {

        var destinations = await readDestination();


        const filter = req?.query?.SELECT?.where;
        let onlyActive = '';

        if (filter) {
            if (
                filter[0].ref[0] === 'isActive' &&
                filter[1] === '=' &&
                filter[2].val === 'X'
            ) {
                onlyActive = 'X';
            }
        }

        if (onlyActive === 'X') {
            var activeDestinations = destinations.filter(dest => dest.isActive === 'X');
            return activeDestinations;

        } else {
            return destinations;
        }

    })

    srv.on('startBatchJob', async (req) => {

        startBatchJob = req.data.start;

    })

    cds.spawn({ every: batchjobInterval * 30 * 1000 }, async () => {

        if (startBatchJob) {
            console.log("Running batchjob.")
            await fetchMPLAndUploadInS3();
        }
    })


});

