service CatalogService {
    action reads3file(filePath : String)                     returns {
        content : String;
    };

    action fetchLogsAndUpload(destination : String)          returns String;

    action updateSubaccountDestination(globalAccount : String,
                                       subAccount : String,
                                       destination : String,
                                       isActive : String ) returns String;

    entity S3JsonData {
        key messageGuid       : String;
            globalAccount     : String;
            subAccount        : String;
            iflowName         : String;
            status            : String;
            statusCriticality : String;
            filePath          : String;
            date              : Date;
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
            iflowName        : String;
            iflowID          : String;
            filePath         : String;
            statusText       : String;
            date             : Date;
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
            date        : DateTime;
            size        : String;
            filePath    : String;
            to_parent   : Association to one S3JsonData;
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
