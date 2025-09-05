/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package plugin

import (
	"context"
	"fmt"
	"strconv"

	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/getkin/kin-openapi/openapi3"
	"golang.org/x/exp/maps"

	model "github.com/coze-dev/coze-studio/backend/api/model/crossdomain/plugin"
	workflowModel "github.com/coze-dev/coze-studio/backend/api/model/crossdomain/workflow"
	"github.com/coze-dev/coze-studio/backend/api/model/plugin_develop/common"
	workflow3 "github.com/coze-dev/coze-studio/backend/api/model/workflow"
	"github.com/coze-dev/coze-studio/backend/application/base/pluginutil"
	crossplugin "github.com/coze-dev/coze-studio/backend/crossdomain/contract/plugin"
	"github.com/coze-dev/coze-studio/backend/domain/plugin/entity"
	"github.com/coze-dev/coze-studio/backend/domain/plugin/service"
	plugin "github.com/coze-dev/coze-studio/backend/domain/plugin/service"
	"github.com/coze-dev/coze-studio/backend/domain/workflow"
	entity2 "github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/infra/contract/storage"
	"github.com/coze-dev/coze-studio/backend/pkg/errorx"
	"github.com/coze-dev/coze-studio/backend/pkg/lang/conv"
	"github.com/coze-dev/coze-studio/backend/pkg/lang/ptr"
	"github.com/coze-dev/coze-studio/backend/pkg/lang/slices"
	"github.com/coze-dev/coze-studio/backend/pkg/sonic"
	"github.com/coze-dev/coze-studio/backend/types/errno"
)

var defaultSVC crossplugin.PluginService

type impl struct {
	DomainSVC plugin.PluginService
	tos       storage.Storage
}

func InitDomainService(c plugin.PluginService, tos storage.Storage) crossplugin.PluginService {
	defaultSVC = &impl{
		DomainSVC: c,
		tos:       tos,
	}

	return defaultSVC
}

func (s *impl) MGetVersionPlugins(ctx context.Context, versionPlugins []model.VersionPlugin) (mPlugins []*model.PluginInfo, err error) {
	plugins, err := s.DomainSVC.MGetVersionPlugins(ctx, versionPlugins)
	if err != nil {
		return nil, err
	}

	mPlugins = slices.Transform(plugins, func(e *entity.PluginInfo) *model.PluginInfo {
		return e.PluginInfo
	})

	return mPlugins, nil
}

func (s *impl) BindAgentTools(ctx context.Context, agentID int64, toolIDs []int64) (err error) {
	return s.DomainSVC.BindAgentTools(ctx, agentID, toolIDs)
}

func (s *impl) DuplicateDraftAgentTools(ctx context.Context, fromAgentID, toAgentID int64) (err error) {
	return s.DomainSVC.DuplicateDraftAgentTools(ctx, fromAgentID, toAgentID)
}

func (s *impl) MGetAgentTools(ctx context.Context, req *model.MGetAgentToolsRequest) (tools []*model.ToolInfo, err error) {
	return s.DomainSVC.MGetAgentTools(ctx, req)
}

func (s *impl) ExecuteTool(ctx context.Context, req *model.ExecuteToolRequest, opts ...model.ExecuteToolOpt) (resp *model.ExecuteToolResponse, err error) {
	return s.DomainSVC.ExecuteTool(ctx, req, opts...)
}

func (s *impl) PublishAgentTools(ctx context.Context, agentID int64, agentVersion string) (err error) {
	return s.DomainSVC.PublishAgentTools(ctx, agentID, agentVersion)
}

func (s *impl) DeleteDraftPlugin(ctx context.Context, pluginID int64) (err error) {
	return s.DomainSVC.DeleteDraftPlugin(ctx, pluginID)
}

func (s *impl) PublishPlugin(ctx context.Context, req *model.PublishPluginRequest) (err error) {
	return s.DomainSVC.PublishPlugin(ctx, req)
}

func (s *impl) PublishAPPPlugins(ctx context.Context, req *model.PublishAPPPluginsRequest) (resp *model.PublishAPPPluginsResponse, err error) {
	return s.DomainSVC.PublishAPPPlugins(ctx, req)
}

func (s *impl) MGetPluginLatestVersion(ctx context.Context, pluginIDs []int64) (resp *model.MGetPluginLatestVersionResponse, err error) {
	return s.DomainSVC.MGetPluginLatestVersion(ctx, pluginIDs)
}

func (s *impl) MGetVersionTools(ctx context.Context, versionTools []model.VersionTool) (tools []*model.ToolInfo, err error) {
	return s.DomainSVC.MGetVersionTools(ctx, versionTools)
}

func (s *impl) GetAPPAllPlugins(ctx context.Context, appID int64) (plugins []*model.PluginInfo, err error) {
	_plugins, err := s.DomainSVC.GetAPPAllPlugins(ctx, appID)
	if err != nil {
		return nil, err
	}

	plugins = slices.Transform(_plugins, func(e *entity.PluginInfo) *model.PluginInfo {
		return e.PluginInfo
	})

	return plugins, nil
}

type pluginInfo struct {
	*entity.PluginInfo
	LatestVersion *string
}

func (s *impl) getPluginsWithTools(ctx context.Context, pluginEntity *model.PluginEntity, toolIDs []int64, isDraft bool) (
	_ *pluginInfo, toolsInfo []*entity.ToolInfo, err error) {
	defer func() {
		if err != nil {
			err = vo.WrapIfNeeded(errno.ErrPluginAPIErr, err)
		}
	}()

	var pluginsInfo []*entity.PluginInfo
	var latestPluginInfo *entity.PluginInfo
	pluginID := pluginEntity.PluginID
	if isDraft {
		plugins, err := s.DomainSVC.MGetDraftPlugins(ctx, []int64{pluginID})
		if err != nil {
			return nil, nil, err
		}
		pluginsInfo = plugins
	} else if pluginEntity.PluginVersion == nil || (pluginEntity.PluginVersion != nil && *pluginEntity.PluginVersion == "") {
		plugins, err := s.DomainSVC.MGetOnlinePlugins(ctx, []int64{pluginID})
		if err != nil {
			return nil, nil, err
		}
		pluginsInfo = plugins

	} else {
		plugins, err := s.DomainSVC.MGetVersionPlugins(ctx, []entity.VersionPlugin{
			{PluginID: pluginID, Version: *pluginEntity.PluginVersion},
		})
		if err != nil {
			return nil, nil, err
		}
		pluginsInfo = plugins

		onlinePlugins, err := s.DomainSVC.MGetOnlinePlugins(ctx, []int64{pluginID})
		if err != nil {
			return nil, nil, err
		}
		for _, pi := range onlinePlugins {
			if pi.ID == pluginID {
				latestPluginInfo = pi
				break
			}
		}
	}

	var pInfo *entity.PluginInfo
	for _, p := range pluginsInfo {
		if p.ID == pluginID {
			pInfo = p
			break
		}
	}
	if pInfo == nil {
		return nil, nil, vo.NewError(errno.ErrPluginIDNotFound, errorx.KV("id", strconv.FormatInt(pluginID, 10)))
	}

	if isDraft {
		tools, err := s.DomainSVC.MGetDraftTools(ctx, toolIDs)
		if err != nil {
			return nil, nil, err
		}
		toolsInfo = tools
	} else if pluginEntity.PluginVersion == nil || (pluginEntity.PluginVersion != nil && *pluginEntity.PluginVersion == "") {
		tools, err := s.DomainSVC.MGetOnlineTools(ctx, toolIDs)
		if err != nil {
			return nil, nil, err
		}
		toolsInfo = tools
	} else {
		eVersionTools := slices.Transform(toolIDs, func(tid int64) entity.VersionTool {
			return entity.VersionTool{
				ToolID:  tid,
				Version: *pluginEntity.PluginVersion,
			}
		})
		tools, err := s.DomainSVC.MGetVersionTools(ctx, eVersionTools)
		if err != nil {
			return nil, nil, err
		}
		toolsInfo = tools
	}

	if latestPluginInfo != nil {
		return &pluginInfo{PluginInfo: pInfo, LatestVersion: latestPluginInfo.Version}, toolsInfo, nil
	}

	return &pluginInfo{PluginInfo: pInfo}, toolsInfo, nil
}

func (s *impl) GetPluginToolsInfo(ctx context.Context, req *model.ToolsInfoRequest) (
	_ *model.ToolsInfoResponse, err error) {
	defer func() {
		if err != nil {
			err = vo.WrapIfNeeded(errno.ErrPluginAPIErr, err)
		}
	}()

	var toolsInfo []*entity.ToolInfo
	isDraft := req.IsDraft || (req.PluginEntity.PluginVersion != nil && *req.PluginEntity.PluginVersion == "0")
	pInfo, toolsInfo, err := s.getPluginsWithTools(ctx, &model.PluginEntity{PluginID: req.PluginEntity.PluginID, PluginVersion: req.PluginEntity.PluginVersion}, req.ToolIDs, isDraft)
	if err != nil {
		return nil, err
	}

	url, err := s.tos.GetObjectUrl(ctx, pInfo.GetIconURI())
	if err != nil {
		return nil, vo.WrapIfNeeded(errno.ErrTOSError, err)
	}

	response := &model.ToolsInfoResponse{
		PluginID:      pInfo.ID,
		SpaceID:       pInfo.SpaceID,
		Version:       pInfo.GetVersion(),
		PluginName:    pInfo.GetName(),
		Description:   pInfo.GetDesc(),
		IconURL:       url,
		PluginType:    int64(pInfo.PluginType),
		ToolInfoList:  make(map[int64]model.ToolInfoW),
		LatestVersion: pInfo.LatestVersion,
		IsOfficial:    pInfo.IsOfficial(),
		AppID:         pInfo.GetAPPID(),
	}

	for _, tf := range toolsInfo {
		inputs, err := tf.ToReqAPIParameter()
		if err != nil {
			return nil, err
		}
		outputs, err := tf.ToRespAPIParameter()
		if err != nil {
			return nil, err
		}
		toolExample := pInfo.GetToolExample(ctx, tf.GetName())

		var (
			requestExample  string
			responseExample string
		)
		if toolExample != nil {
			requestExample = toolExample.RequestExample
			responseExample = toolExample.ResponseExample
		}

		response.ToolInfoList[tf.ID] = model.ToolInfoW{
			ToolID:      tf.ID,
			ToolName:    tf.GetName(),
			Inputs:      slices.Transform(inputs, toWorkflowAPIParameter),
			Outputs:     slices.Transform(outputs, toWorkflowAPIParameter),
			Description: tf.GetDesc(),
			DebugExample: &model.DebugExample{
				ReqExample:  requestExample,
				RespExample: responseExample,
			},
		}

	}
	return response, nil
}

func (s *impl) GetPluginInvokableTools(ctx context.Context, req *model.ToolsInvokableRequest) (
	_ map[int64]crossplugin.InvokableTool, err error) {
	defer func() {
		if err != nil {
			err = vo.WrapIfNeeded(errno.ErrPluginAPIErr, err)
		}
	}()

	var toolsInfo []*entity.ToolInfo
	isDraft := req.IsDraft || (req.PluginEntity.PluginVersion != nil && *req.PluginEntity.PluginVersion == "0")
	pInfo, toolsInfo, err := s.getPluginsWithTools(ctx, &model.PluginEntity{
		PluginID:      req.PluginEntity.PluginID,
		PluginVersion: req.PluginEntity.PluginVersion,
	}, maps.Keys(req.ToolsInvokableInfo), isDraft)
	if err != nil {
		return nil, err
	}

	result := map[int64]crossplugin.InvokableTool{}
	for _, tf := range toolsInfo {
		tl := &pluginInvokeTool{
			pluginEntity: model.PluginEntity{
				PluginID:      pInfo.ID,
				PluginVersion: pInfo.Version,
			},
			client:   s.DomainSVC,
			toolInfo: tf,
			IsDraft:  isDraft,
		}

		if r, ok := req.ToolsInvokableInfo[tf.ID]; ok && (r.RequestAPIParametersConfig != nil && r.ResponseAPIParametersConfig != nil) {
			reqPluginCommonAPIParameters := slices.Transform(r.RequestAPIParametersConfig, toPluginCommonAPIParameter)
			respPluginCommonAPIParameters := slices.Transform(r.ResponseAPIParametersConfig, toPluginCommonAPIParameter)

			tl.toolOperation, err = pluginutil.APIParamsToOpenapiOperation(reqPluginCommonAPIParameters, respPluginCommonAPIParameters)
			if err != nil {
				return nil, err
			}

			tl.toolOperation.OperationID = tf.Operation.OperationID
			tl.toolOperation.Summary = tf.Operation.Summary
		}

		result[tf.ID] = tl
	}
	return result, nil
}

func (s *impl) ExecutePlugin(ctx context.Context, input map[string]any, pe *model.PluginEntity,
	toolID int64, cfg workflowModel.ExecuteConfig) (map[string]any, error) {
	args, err := sonic.MarshalString(input)
	if err != nil {
		return nil, vo.WrapError(errno.ErrSerializationDeserializationFail, err)
	}

	var uID string
	if cfg.AgentID != nil {
		uID = cfg.ConnectorUID
	} else {
		uID = conv.Int64ToStr(cfg.Operator)
	}

	req := &service.ExecuteToolRequest{
		UserID:          uID,
		PluginID:        pe.PluginID,
		ToolID:          toolID,
		ExecScene:       model.ExecSceneOfWorkflow,
		ArgumentsInJson: args,
		ExecDraftTool:   pe.PluginVersion == nil || *pe.PluginVersion == "0",
	}
	execOpts := []entity.ExecuteToolOpt{
		model.WithInvalidRespProcessStrategy(model.InvalidResponseProcessStrategyOfReturnDefault),
	}

	if pe.PluginVersion != nil {
		execOpts = append(execOpts, model.WithToolVersion(*pe.PluginVersion))
	}

	r, err := s.DomainSVC.ExecuteTool(ctx, req, execOpts...)
	if err != nil {
		if extra, ok := compose.IsInterruptRerunError(err); ok {
			pluginTIE, ok := extra.(*model.ToolInterruptEvent)
			if !ok {
				return nil, vo.WrapError(errno.ErrPluginAPIErr, fmt.Errorf("expects ToolInterruptEvent, got %T", extra))
			}

			var eventType workflow3.EventType
			switch pluginTIE.Event {
			case model.InterruptEventTypeOfToolNeedOAuth:
				eventType = workflow3.EventType_WorkflowOauthPlugin
			default:
				return nil, vo.WrapError(errno.ErrPluginAPIErr,
					fmt.Errorf("unsupported interrupt event type: %s", pluginTIE.Event))
			}

			id, err := workflow.GetRepository().GenID(ctx)
			if err != nil {
				return nil, vo.WrapError(errno.ErrIDGenError, err)
			}

			ie := &entity2.InterruptEvent{
				ID:            id,
				InterruptData: pluginTIE.ToolNeedOAuth.Message,
				EventType:     eventType,
			}

			// temporarily replace interrupt with real error, until frontend can handle plugin oauth interrupt
			interruptData := ie.InterruptData
			return nil, vo.NewError(errno.ErrAuthorizationRequired, errorx.KV("extra", interruptData))
		}
		return nil, err
	}

	var output map[string]any
	err = sonic.UnmarshalString(r.TrimmedResp, &output)
	if err != nil {
		return nil, vo.WrapError(errno.ErrSerializationDeserializationFail, err)
	}

	return output, nil
}

type pluginInvokeTool struct {
	pluginEntity  model.PluginEntity
	client        service.PluginService
	toolInfo      *entity.ToolInfo
	toolOperation *openapi3.Operation
	IsDraft       bool
}

func (p *pluginInvokeTool) Info(ctx context.Context) (_ *schema.ToolInfo, err error) {
	defer func() {
		if err != nil {
			err = vo.WrapIfNeeded(errno.ErrPluginAPIErr, err)
		}
	}()

	var parameterInfo map[string]*schema.ParameterInfo
	if p.toolOperation != nil {
		parameterInfo, err = model.NewOpenapi3Operation(p.toolOperation).ToEinoSchemaParameterInfo(ctx)
	} else {
		parameterInfo, err = p.toolInfo.Operation.ToEinoSchemaParameterInfo(ctx)
	}

	if err != nil {
		return nil, err
	}

	return &schema.ToolInfo{
		Name:        p.toolInfo.GetName(),
		Desc:        p.toolInfo.GetDesc(),
		ParamsOneOf: schema.NewParamsOneOfByParams(parameterInfo),
	}, nil
}

func (p *pluginInvokeTool) PluginInvoke(ctx context.Context, argumentsInJSON string, cfg workflowModel.ExecuteConfig) (string, error) {
	req := &service.ExecuteToolRequest{
		UserID:          conv.Int64ToStr(cfg.Operator),
		PluginID:        p.pluginEntity.PluginID,
		ToolID:          p.toolInfo.ID,
		ExecScene:       model.ExecSceneOfWorkflow,
		ArgumentsInJson: argumentsInJSON,
		ExecDraftTool:   p.IsDraft,
	}
	execOpts := []entity.ExecuteToolOpt{
		model.WithInvalidRespProcessStrategy(model.InvalidResponseProcessStrategyOfReturnDefault),
	}

	if p.pluginEntity.PluginVersion != nil {
		execOpts = append(execOpts, model.WithToolVersion(*p.pluginEntity.PluginVersion))
	}

	if p.toolOperation != nil {
		execOpts = append(execOpts, model.WithOpenapiOperation(model.NewOpenapi3Operation(p.toolOperation)))
	}

	r, err := p.client.ExecuteTool(ctx, req, execOpts...)
	if err != nil {
		if extra, ok := compose.IsInterruptRerunError(err); ok {
			pluginTIE, ok := extra.(*model.ToolInterruptEvent)
			if !ok {
				return "", vo.WrapError(errno.ErrPluginAPIErr, fmt.Errorf("expects ToolInterruptEvent, got %T", extra))
			}

			var eventType workflow3.EventType
			switch pluginTIE.Event {
			case model.InterruptEventTypeOfToolNeedOAuth:
				eventType = workflow3.EventType_WorkflowOauthPlugin
			default:
				return "", vo.WrapError(errno.ErrPluginAPIErr,
					fmt.Errorf("unsupported interrupt event type: %s", pluginTIE.Event))
			}

			id, err := workflow.GetRepository().GenID(ctx)
			if err != nil {
				return "", vo.WrapError(errno.ErrIDGenError, err)
			}

			ie := &entity2.InterruptEvent{
				ID:            id,
				InterruptData: pluginTIE.ToolNeedOAuth.Message,
				EventType:     eventType,
			}

			tie := &entity2.ToolInterruptEvent{
				ToolCallID:     compose.GetToolCallID(ctx),
				ToolName:       p.toolInfo.GetName(),
				InterruptEvent: ie,
			}

			// temporarily replace interrupt with real error, until frontend can handle plugin oauth interrupt
			_ = tie
			interruptData := ie.InterruptData
			return "", vo.NewError(errno.ErrAuthorizationRequired, errorx.KV("extra", interruptData))
		}
		return "", err
	}
	return r.TrimmedResp, nil
}

func toPluginCommonAPIParameter(parameter *workflow3.APIParameter) *common.APIParameter {
	if parameter == nil {
		return nil
	}
	p := &common.APIParameter{
		ID:            parameter.ID,
		Name:          parameter.Name,
		Desc:          parameter.Desc,
		Type:          common.ParameterType(parameter.Type),
		Location:      common.ParameterLocation(parameter.Location),
		IsRequired:    parameter.IsRequired,
		GlobalDefault: parameter.GlobalDefault,
		GlobalDisable: parameter.GlobalDisable,
		LocalDefault:  parameter.LocalDefault,
		LocalDisable:  parameter.LocalDisable,
		VariableRef:   parameter.VariableRef,
	}
	if parameter.SubType != nil {
		p.SubType = ptr.Of(common.ParameterType(*parameter.SubType))
	}

	if parameter.DefaultParamSource != nil {
		p.DefaultParamSource = ptr.Of(common.DefaultParamSource(*parameter.DefaultParamSource))
	}
	if parameter.AssistType != nil {
		p.AssistType = ptr.Of(common.AssistParameterType(*parameter.AssistType))
	}

	if len(parameter.SubParameters) > 0 {
		p.SubParameters = make([]*common.APIParameter, 0, len(parameter.SubParameters))
		for _, subParam := range parameter.SubParameters {
			p.SubParameters = append(p.SubParameters, toPluginCommonAPIParameter(subParam))
		}
	}

	return p
}

func toWorkflowAPIParameter(parameter *common.APIParameter) *workflow3.APIParameter {
	if parameter == nil {
		return nil
	}
	p := &workflow3.APIParameter{
		ID:            parameter.ID,
		Name:          parameter.Name,
		Desc:          parameter.Desc,
		Type:          workflow3.ParameterType(parameter.Type),
		Location:      workflow3.ParameterLocation(parameter.Location),
		IsRequired:    parameter.IsRequired,
		GlobalDefault: parameter.GlobalDefault,
		GlobalDisable: parameter.GlobalDisable,
		LocalDefault:  parameter.LocalDefault,
		LocalDisable:  parameter.LocalDisable,
		VariableRef:   parameter.VariableRef,
	}
	if parameter.SubType != nil {
		p.SubType = ptr.Of(workflow3.ParameterType(*parameter.SubType))
	}

	if parameter.DefaultParamSource != nil {
		p.DefaultParamSource = ptr.Of(workflow3.DefaultParamSource(*parameter.DefaultParamSource))
	}
	if parameter.AssistType != nil {
		p.AssistType = ptr.Of(workflow3.AssistParameterType(*parameter.AssistType))
	}

	// Check if it's an array that needs unwrapping.
	if parameter.Type == common.ParameterType_Array && len(parameter.SubParameters) == 1 && parameter.SubParameters[0].Name == "[Array Item]" {
		arrayItem := parameter.SubParameters[0]
		p.SubType = ptr.Of(workflow3.ParameterType(arrayItem.Type))
		// If the "[Array Item]" is an object, its sub-parameters become the array's sub-parameters.
		if arrayItem.Type == common.ParameterType_Object {
			p.SubParameters = make([]*workflow3.APIParameter, 0, len(arrayItem.SubParameters))
			for _, subParam := range arrayItem.SubParameters {
				p.SubParameters = append(p.SubParameters, toWorkflowAPIParameter(subParam))
			}
		} else {
			// The array's SubType is the Type of the "[Array Item]".
			p.SubParameters = make([]*workflow3.APIParameter, 0, 1)
			p.SubParameters = append(p.SubParameters, toWorkflowAPIParameter(arrayItem))
			p.SubParameters[0].Name = "" // Remove the "[Array Item]" name.
		}
	} else if len(parameter.SubParameters) > 0 { // A simple object or a non-wrapped array.
		p.SubParameters = make([]*workflow3.APIParameter, 0, len(parameter.SubParameters))
		for _, subParam := range parameter.SubParameters {
			p.SubParameters = append(p.SubParameters, toWorkflowAPIParameter(subParam))
		}
	}

	return p
}
