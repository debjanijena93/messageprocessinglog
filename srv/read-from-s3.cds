service CatalogService {
    action reads3file(filePath : String)                 returns {
        content : String;
    };

    action fetchLogsAndUpload(destination : String,
                              globalAccount : String,
                              subAccount : String,  
                              startDate : Date,
                              endDate : Date)             returns String;

    action addDestination(globalAccount : String,
                          subAccount : String,
                          destination : String, )        returns String;

    action deactivateDestination(globalAccount : String,
                                 subAccount : String,
                                 destination : String,
                                 deactivate: String ) returns String;

    action startBatchJob(start : String)                 returns String;


    entity S3JsonData {
        key messageGuid       : String;
            globalAccount     : String;
            subAccount        : String;
            iFlowName         : String;
            status            : String;
            statusCriticality : String;
            filePath          : String;
            date              : Timestamp;
            processingTime    : String;
            to_Details        : Composition of one S3JsonObject
                                    on to_Details.messageGuid = messageGuid;
            to_Attachments    : Composition of many S3Attachment
                                    on to_Attachments.messageGuid = messageGuid;
    }

    entity S3JsonObject {
        key messageGuid      : String;
            correlationID    : String;
            globalAccount    : String;
            subAccount       : String;
            iFlowName        : String;
            iflowID          : String;
            filePath         : String;
            statusText       : String;
            date             : Timestamp;
            processingTime   : String;
            type             : String;
            package          : String;
            errorInfoMessage : String;
            to_parent        : Association to one S3JsonData;
    }

    entity S3Attachment {
        key messageGuid : String;
        key fileName    : String;
            fileType    : String;
            date        : Timestamp;
            size        : String;
            filePath    : String;
            to_parent   : Association to one S3JsonData;
    }

    entity destinations {
        key globalAccount : String;
        key subAccount    : String;
            destination   : String;
            isActive      : String;
    }

    entity statusVH {
        key id   : String;
            text : String;
    }

    entity subAccountVH {
        key subAccount    : String;
            globalAccount : String;
    }

    entity globalAccountVH {
        key globalAccount : String;
    }


}

annotate CatalogService.S3JsonData with {
    status        @Common.ValueList: {
        Label         : 'Status',
        CollectionPath: 'statusVH',
        Parameters    : [
            {
                $Type            : 'Common.ValueListParameterInOut',
                LocalDataProperty: 'status',
                ValueListProperty: 'id'
            },
            {
                $Type            : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty: 'text'
            }
        ]
    };

    globalAccount @Common.ValueList: {
        Label         : 'Global Account',
        CollectionPath: 'globalAccountVH',
        Parameters    : [
            {
                $Type            : 'Common.ValueListParameterInOut',
                LocalDataProperty: 'globalAccount',
                ValueListProperty: 'globalAccount'
            },
            {
                $Type            : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty: 'globalAccount'
            }
        ]
    };

    subAccount    @Common.ValueList: {
        Label         : 'Sub Account',
        CollectionPath: 'subAccountVH',
        Parameters    : [
            {
                $Type            : 'Common.ValueListParameterIn',
                LocalDataProperty: 'globalAccount',
                ValueListProperty: 'globalAccount'
            },
            {
                $Type            : 'Common.ValueListParameterInOut',
                LocalDataProperty: 'subAccount',
                ValueListProperty: 'subAccount'
            }
        ]
    };


};
