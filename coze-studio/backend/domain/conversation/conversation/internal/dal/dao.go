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

package dal

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/coze-dev/coze-studio/backend/api/model/conversation/common"
	"github.com/coze-dev/coze-studio/backend/api/model/crossdomain/conversation"
	"github.com/coze-dev/coze-studio/backend/domain/conversation/conversation/entity"
	"github.com/coze-dev/coze-studio/backend/domain/conversation/conversation/internal/dal/model"
	"github.com/coze-dev/coze-studio/backend/domain/conversation/conversation/internal/dal/query"
	"github.com/coze-dev/coze-studio/backend/infra/contract/idgen"
	"github.com/coze-dev/coze-studio/backend/pkg/lang/slices"
)

type ConversationDAO struct {
	idgen idgen.IDGenerator
	db    *gorm.DB
	query *query.Query
}

func NewConversationDAO(db *gorm.DB, generator idgen.IDGenerator) *ConversationDAO {
	return &ConversationDAO{
		idgen: generator,
		db:    db,
		query: query.Use(db),
	}
}

func (dao *ConversationDAO) Create(ctx context.Context, msg *entity.Conversation) (*entity.Conversation, error) {
	poData := dao.conversationDO2PO(ctx, msg)

	ids, err := dao.idgen.GenMultiIDs(ctx, 2)
	if err != nil {
		return nil, err
	}
	poData.ID = ids[0]
	poData.SectionID = ids[1]

	err = dao.query.Conversation.WithContext(ctx).Create(poData)
	if err != nil {
		return nil, err
	}
	return dao.conversationPO2DO(ctx, poData), nil
}

func (dao *ConversationDAO) GetByID(ctx context.Context, id int64) (*entity.Conversation, error) {
	poData, err := dao.query.Conversation.WithContext(ctx).Debug().Where(dao.query.Conversation.ID.Eq(id)).First()

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}
	return dao.conversationPO2DO(ctx, poData), nil
}

func (dao *ConversationDAO) UpdateSection(ctx context.Context, id int64) (int64, error) {
	updateColumn := make(map[string]interface{})
	table := dao.query.Conversation
	newSectionID, err := dao.idgen.GenID(ctx)
	if err != nil {
		return 0, err
	}
	updateColumn[table.SectionID.ColumnName().String()] = newSectionID
	updateColumn[table.UpdatedAt.ColumnName().String()] = time.Now().UnixMilli()

	_, err = dao.query.Conversation.WithContext(ctx).Where(dao.query.Conversation.ID.Eq(id)).UpdateColumns(updateColumn)
	if err != nil {
		return 0, err
	}
	return newSectionID, nil
}

func (dao *ConversationDAO) Delete(ctx context.Context, id int64) (int64, error) {
	table := dao.query.Conversation

	updateColumn := make(map[string]interface{})
	updateColumn[table.UpdatedAt.ColumnName().String()] = time.Now().UnixMilli()
	updateColumn[table.Status.ColumnName().String()] = conversation.ConversationStatusDeleted

	updateRes, err := dao.query.Conversation.WithContext(ctx).Where(dao.query.Conversation.ID.Eq(id)).UpdateColumns(updateColumn)
	if err != nil {
		return 0, err
	}
	return updateRes.RowsAffected, err
}

func (dao *ConversationDAO) Get(ctx context.Context, userID int64, agentID int64, scene int32, connectorID int64) (*entity.Conversation, error) {
	po, err := dao.query.Conversation.WithContext(ctx).Debug().
		Where(dao.query.Conversation.CreatorID.Eq(userID)).
		Where(dao.query.Conversation.AgentID.Eq(agentID)).
		Where(dao.query.Conversation.Scene.Eq(scene)).
		Where(dao.query.Conversation.ConnectorID.Eq(connectorID)).
		Where(dao.query.Conversation.Status.Eq(int32(conversation.ConversationStatusNormal))).
		Order(dao.query.Conversation.CreatedAt.Desc()).
		First()

	if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return dao.conversationPO2DO(ctx, po), nil
}

func (dao *ConversationDAO) List(ctx context.Context, userID int64, agentID int64, connectorID int64, scene int32, limit int, page int) ([]*entity.Conversation, bool, error) {
	var hasMore bool

	do := dao.query.Conversation.WithContext(ctx).Debug()
	do = do.Where(dao.query.Conversation.CreatorID.Eq(userID)).
		Where(dao.query.Conversation.AgentID.Eq(agentID)).
		Where(dao.query.Conversation.Scene.Eq(scene)).
		Where(dao.query.Conversation.ConnectorID.Eq(connectorID))

	do = do.Offset((page - 1) * limit)

	if limit > 0 {
		do = do.Limit(int(limit) + 1)
	}

	poList, err := do.Find()

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, hasMore, nil
	}
	if err != nil {
		return nil, hasMore, err
	}

	if len(poList) == 0 {
		return nil, hasMore, nil
	}
	if len(poList) > limit {
		hasMore = true
		return dao.conversationBatchPO2DO(ctx, poList[:(len(poList)-1)]), hasMore, nil

	}
	return dao.conversationBatchPO2DO(ctx, poList), hasMore, nil
}

func (dao *ConversationDAO) conversationDO2PO(ctx context.Context, conversation *entity.Conversation) *model.Conversation {
	return &model.Conversation{
		ID:          conversation.ID,
		SectionID:   conversation.SectionID,
		ConnectorID: conversation.ConnectorID,
		AgentID:     conversation.AgentID,
		CreatorID:   conversation.CreatorID,
		Scene:       int32(conversation.Scene),
		Status:      int32(conversation.Status),
		Ext:         conversation.Ext,
		CreatedAt:   time.Now().UnixMilli(),
		UpdatedAt:   time.Now().UnixMilli(),
	}
}

func (dao *ConversationDAO) conversationPO2DO(ctx context.Context, c *model.Conversation) *entity.Conversation {
	return &entity.Conversation{
		ID:          c.ID,
		SectionID:   c.SectionID,
		ConnectorID: c.ConnectorID,
		AgentID:     c.AgentID,
		CreatorID:   c.CreatorID,
		Scene:       common.Scene(c.Scene),
		Status:      conversation.ConversationStatus(c.Status),
		Ext:         c.Ext,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

func (dao *ConversationDAO) conversationBatchPO2DO(ctx context.Context, conversations []*model.Conversation) []*entity.Conversation {
	return slices.Transform(conversations, func(c *model.Conversation) *entity.Conversation {
		return &entity.Conversation{
			ID:          c.ID,
			SectionID:   c.SectionID,
			ConnectorID: c.ConnectorID,
			AgentID:     c.AgentID,
			CreatorID:   c.CreatorID,
			Scene:       common.Scene(c.Scene),
			Status:      conversation.ConversationStatus(c.Status),
			Ext:         c.Ext,
			CreatedAt:   c.CreatedAt,
			UpdatedAt:   c.UpdatedAt,
		}
	})
}
