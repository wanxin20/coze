
include "./message.thrift"
namespace go conversation.message

service MessageService {
    message.GetMessageListResponse GetMessageList(1: message.GetMessageListRequest request)(api.post='/api/conversation/get_message_list', api.category="conversation", api.gen_path= "message")
    message.DeleteMessageResponse DeleteMessage(1: message.DeleteMessageRequest request)(api.post='/api/conversation/delete_message', api.category="conversation", api.gen_path= "message")
    message.BreakMessageResponse BreakMessage(1: message.BreakMessageRequest request)(api.post='/api/conversation/break_message', api.category="conversation", api.gen_path= "message")
    message.ListMessageApiResponse GetApiMessageList(1: message.ListMessageApiRequest request)(api.post='/v1/conversation/message/list', api.category="conversation", api.gen_path= "message")
}