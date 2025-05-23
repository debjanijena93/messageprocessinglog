sap.ui.define([
    "sap/m/MessageToast"
], function () {
    'use strict';

    return {
        onNamePress: async function (oEvent) {
            const oLink = oEvent.getSource();
            const oContext = oLink.getBindingContext();
            console.log("Context: ", oContext)
            
            if (!oContext) {
                console.error("No binding context found");
                return;
            }

            const oData = oContext.getObject(); // <- this retrieves full entity data
            console.log("Full entity data:", oData);

            const filePath = oData.filePath + 'Attachments/' + oData.fileName;

            try {

                const response = await fetch("/odata/v4/catalog/reads3file", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ filePath })  
                });


                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.statusText}`);
                }

                const result = await response.json();

                // Convert base64 to binary
                const byteCharacters = atob(result.base64Content);
                const byteArrays = [];

                for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                    const slice = byteCharacters.slice(offset, offset + 512);
                    const byteNumbers = new Array(slice.length);
                    for (let i = 0; i < slice.length; i++) {
                        byteNumbers[i] = slice.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    byteArrays.push(byteArray);
                }

                const blob = new Blob(byteArrays, { type: result.contentType });

                // Open in new tab
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, "_blank");

                // Optional: Revoke the object URL after some time
                setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

            } catch (err) {
                console.error("Failed to fetch S3 file content:", err);
            }
        }
    };
});
