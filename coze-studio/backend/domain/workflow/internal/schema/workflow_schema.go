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

package schema

import (
	"fmt"
	"maps"
	"reflect"
	"sync"

	"github.com/cloudwego/eino/compose"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
)

type WorkflowSchema struct {
	Nodes       []*NodeSchema                `json:"nodes"`
	Connections []*Connection                `json:"connections"`
	Hierarchy   map[vo.NodeKey]vo.NodeKey    `json:"hierarchy,omitempty"` // child node key-> parent node key
	Branches    map[vo.NodeKey]*BranchSchema `json:"branches,omitempty"`

	GeneratedNodes []vo.NodeKey `json:"generated_nodes,omitempty"` // generated nodes for the nodes in batch mode

	nodeMap           map[vo.NodeKey]*NodeSchema // won't serialize this
	compositeNodes    []*CompositeNode           // won't serialize this
	requireCheckPoint bool                       // won't serialize this
	requireStreaming  bool

	once sync.Once
}

type Connection struct {
	FromNode vo.NodeKey `json:"from_node"`
	ToNode   vo.NodeKey `json:"to_node"`
	FromPort *string    `json:"from_port,omitempty"`
}

func (c *Connection) ID() string {
	if c.FromPort != nil {
		return fmt.Sprintf("%s:%s:%v", c.FromNode, c.ToNode, *c.FromPort)
	}
	return fmt.Sprintf("%v:%v", c.FromNode, c.ToNode)
}

type CompositeNode struct {
	Parent   *NodeSchema
	Children []*NodeSchema
}

func (w *WorkflowSchema) Init() {
	w.once.Do(func() {
		w.nodeMap = make(map[vo.NodeKey]*NodeSchema)
		for _, node := range w.Nodes {
			w.nodeMap[node.Key] = node
		}

		w.doGetCompositeNodes()

		for _, node := range w.Nodes {
			if node.Type == entity.NodeTypeSubWorkflow {
				node.SubWorkflowSchema.Init()
				if node.SubWorkflowSchema.requireCheckPoint {
					w.requireCheckPoint = true
					break
				}
			}

			if rc, ok := node.Configs.(RequireCheckpoint); ok {
				if rc.RequireCheckpoint() {
					w.requireCheckPoint = true
					break
				}
			}
		}

		w.requireStreaming = w.doRequireStreaming()
	})
}

func (w *WorkflowSchema) GetNode(key vo.NodeKey) *NodeSchema {
	return w.nodeMap[key]
}

func (w *WorkflowSchema) GetAllNodes() map[vo.NodeKey]*NodeSchema {
	return w.nodeMap // TODO: needs to calculate node count separately, considering batch mode nodes
}

func (w *WorkflowSchema) GetCompositeNodes() []*CompositeNode {
	if w.compositeNodes == nil {
		w.compositeNodes = w.doGetCompositeNodes()
	}

	return w.compositeNodes
}

func (w *WorkflowSchema) GetBranch(key vo.NodeKey) *BranchSchema {
	if w.Branches == nil {
		return nil
	}

	return w.Branches[key]
}

func (w *WorkflowSchema) RequireCheckpoint() bool {
	return w.requireCheckPoint
}

func (w *WorkflowSchema) RequireStreaming() bool {
	return w.requireStreaming
}

func (w *WorkflowSchema) doGetCompositeNodes() (cNodes []*CompositeNode) {
	if w.Hierarchy == nil {
		return nil
	}

	// Build parent to children mapping
	parentToChildren := make(map[vo.NodeKey][]*NodeSchema)
	for childKey, parentKey := range w.Hierarchy {
		if parentSchema := w.nodeMap[parentKey]; parentSchema != nil {
			if childSchema := w.nodeMap[childKey]; childSchema != nil {
				parentToChildren[parentKey] = append(parentToChildren[parentKey], childSchema)
			}
		}
	}

	// Create composite nodes
	for parentKey, children := range parentToChildren {
		if parentSchema := w.nodeMap[parentKey]; parentSchema != nil {
			cNodes = append(cNodes, &CompositeNode{
				Parent:   parentSchema,
				Children: children,
			})
		}
	}

	return cNodes
}

func IsInSameWorkflow(n map[vo.NodeKey]vo.NodeKey, nodeKey, otherNodeKey vo.NodeKey) bool {
	if n == nil {
		return true
	}

	myParents, myParentExists := n[nodeKey]
	theirParents, theirParentExists := n[otherNodeKey]

	if !myParentExists && !theirParentExists {
		return true
	}

	if !myParentExists || !theirParentExists {
		return false
	}

	return myParents == theirParents
}

func IsBelowOneLevel(n map[vo.NodeKey]vo.NodeKey, nodeKey, otherNodeKey vo.NodeKey) bool {
	if n == nil {
		return false
	}
	_, myParentExists := n[nodeKey]
	_, theirParentExists := n[otherNodeKey]

	return myParentExists && !theirParentExists
}

func IsParentOf(n map[vo.NodeKey]vo.NodeKey, nodeKey, otherNodeKey vo.NodeKey) bool {
	if n == nil {
		return false
	}
	theirParent, theirParentExists := n[otherNodeKey]

	return theirParentExists && theirParent == nodeKey
}

func (w *WorkflowSchema) IsEqual(other *WorkflowSchema) bool {
	otherConnectionsMap := make(map[string]bool, len(other.Connections))
	for _, connection := range other.Connections {
		otherConnectionsMap[connection.ID()] = true
	}
	connectionsMap := make(map[string]bool, len(other.Connections))
	for _, connection := range w.Connections {
		connectionsMap[connection.ID()] = true
	}
	if !maps.Equal(otherConnectionsMap, connectionsMap) {
		return false
	}
	otherNodeMap := make(map[vo.NodeKey]*NodeSchema, len(other.Nodes))
	for _, node := range other.Nodes {
		otherNodeMap[node.Key] = node
	}
	nodeMap := make(map[vo.NodeKey]*NodeSchema, len(w.Nodes))

	for _, node := range w.Nodes {
		nodeMap[node.Key] = node
	}

	if !maps.EqualFunc(otherNodeMap, nodeMap, func(node *NodeSchema, other *NodeSchema) bool {
		if node.Name != other.Name {
			return false
		}
		if !reflect.DeepEqual(node.Configs, other.Configs) {
			return false
		}
		if !reflect.DeepEqual(node.InputTypes, other.InputTypes) {
			return false
		}
		if !reflect.DeepEqual(node.InputSources, other.InputSources) {
			return false
		}

		if !reflect.DeepEqual(node.OutputTypes, other.OutputTypes) {
			return false
		}
		if !reflect.DeepEqual(node.OutputSources, other.OutputSources) {
			return false
		}
		if !reflect.DeepEqual(node.ExceptionConfigs, other.ExceptionConfigs) {
			return false
		}
		if !reflect.DeepEqual(node.SubWorkflowBasic, other.SubWorkflowBasic) {
			return false
		}
		return true

	}) {
		return false
	}

	return true

}

func (w *WorkflowSchema) NodeCount() int32 {
	return int32(len(w.Nodes) - len(w.GeneratedNodes))
}

func (w *WorkflowSchema) doRequireStreaming() bool {
	producers := make(map[vo.NodeKey]bool)
	consumers := make(map[vo.NodeKey]bool)

	for _, node := range w.Nodes {
		if node.StreamConfigs != nil && node.StreamConfigs.CanGeneratesStream {
			producers[node.Key] = true
		}

		if node.StreamConfigs != nil && node.StreamConfigs.RequireStreamingInput {
			consumers[node.Key] = true
		}

	}

	if len(producers) == 0 || len(consumers) == 0 {
		return false
	}

	// Build data-flow graph from InputSources
	adj := make(map[vo.NodeKey]map[vo.NodeKey]struct{})
	for _, node := range w.Nodes {
		for _, source := range node.InputSources {
			if source.Source.Ref != nil && len(source.Source.Ref.FromNodeKey) > 0 {
				if _, ok := adj[source.Source.Ref.FromNodeKey]; !ok {
					adj[source.Source.Ref.FromNodeKey] = make(map[vo.NodeKey]struct{})
				}
				adj[source.Source.Ref.FromNodeKey][node.Key] = struct{}{}
			}
		}
	}

	// For each producer, traverse the graph to see if it can reach a consumer
	for p := range producers {
		q := []vo.NodeKey{p}
		visited := make(map[vo.NodeKey]bool)
		visited[p] = true

		for len(q) > 0 {
			curr := q[0]
			q = q[1:]

			if consumers[curr] {
				return true
			}

			for neighbor := range adj[curr] {
				if !visited[neighbor] {
					visited[neighbor] = true
					q = append(q, neighbor)
				}
			}
		}
	}

	return false
}

func (w *WorkflowSchema) FanInMergeConfigs() map[string]compose.FanInMergeConfig {
	// what we need to do is to see if the workflow requires streaming, if not, then no fan-in merge configs needed
	// then we find those nodes that have 'transform' or 'collect' as streaming paradigm,
	// and see if each of those nodes has multiple data predecessors, if so, it's a fan-in node.
	// then, look up the NodeTypeMeta's ExecutableMeta info and see if it requires fan-in stream merge.
	if !w.requireStreaming {
		return nil
	}

	fanInNodes := make(map[vo.NodeKey]bool)
	for _, node := range w.Nodes {
		if node.StreamConfigs != nil && node.StreamConfigs.RequireStreamingInput {
			var predecessor *vo.NodeKey
			for _, source := range node.InputSources {
				if source.Source.Ref != nil && len(source.Source.Ref.FromNodeKey) > 0 {
					if predecessor != nil {
						fanInNodes[node.Key] = true
						break
					}
					predecessor = &source.Source.Ref.FromNodeKey
				}
			}
		}
	}

	fanInConfigs := make(map[string]compose.FanInMergeConfig)
	for nodeKey := range fanInNodes {
		if m := entity.NodeMetaByNodeType(w.GetNode(nodeKey).Type); m != nil {
			if m.StreamSourceEOFAware {
				fanInConfigs[string(nodeKey)] = compose.FanInMergeConfig{
					StreamMergeWithSourceEOF: true,
				}
			}
		}
	}

	return fanInConfigs
}
