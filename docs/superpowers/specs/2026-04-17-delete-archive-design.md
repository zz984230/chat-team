# 档案柜删除功能设计

## 概述

在前后端添加从"档案柜"（ArchiveDrawer）删除单个 session 档案的功能。采用直接删除策略，删除前需二次确认弹窗，运行中的 session 禁止删除。

## 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 删除策略 | 直接删除 + 确认弹窗 | 用户明确要求，符合"档案柜"隐喻 |
| 批量操作 | 不支持，仅单条删除 | 当前规模不需要，保持简单 |
| 运行中 session | 禁止删除 | 避免破坏正在执行的智能体工作流 |
| API 风格 | RESTful DELETE | 语义清晰，是资源删除的标准做法 |

## 后端设计

### 新增端点

`DELETE /api/sessions/{id}`

**行为：**
1. 查找 session，不存在返回 `404 Not Found`
2. 检查 session 状态，如果是 `running` 或 `paused` 返回 `409 Conflict`，body 包含错误信息
3. 调用 `VaultManager.delete_session(id)` 删除 `vault/sessions/{id}/` 整个目录
4. 返回 `204 No Content`

### VaultManager 变更

`backend/app/vault/manager.py` 新增方法：

```python
def delete_session(self, session_id: str) -> bool:
    session_dir = self.sessions_dir / session_id
    if session_dir.exists():
        shutil.rmtree(session_dir)
        return True
    return False
```

### 测试覆盖

- `test_api.py`：删除存在的 session → 204；删除不存在 session → 404；删除运行中 session → 409
- `test_vault.py`：`delete_session()` 删除后目录不存在；`delete_session()` 对不存在目录返回 False；删除后 `list_sessions()` 不再包含该 session

## 前端设计

### API 层

`frontend/src/services/api.ts` 新增：

```typescript
deleteSession(id: string): Promise<void>
```

调用 `DELETE /api/sessions/{id}`，处理 204（无 body）响应。

### sessionStore 变更

`frontend/src/stores/sessionStore.ts` 新增 action：

```typescript
async deleteSession(id: string): Promise<void>
```

- 调用 `api.deleteSession(id)`
- 从 `sessions` 列表中移除该 session
- 如果删除的是当前 `activeSession`，清除 activeSession

### ArchiveDrawer 变更

`frontend/src/components/overlay/ArchiveDrawer.tsx`：

1. **删除按钮**：每个 session 卡片右上角显示 trash 图标
   - 仅在 status 为 `completed`/`failed`/`cancelled` 时显示
   - hover 时图标变红色

2. **确认弹窗**：点击删除按钮后弹出
   - 复用现有 `Modal` 组件
   - 标题："删除档案"
   - 内容：`确定要删除档案「{input_requirement 前30字}...」吗？此操作不可恢复。`
   - 按钮："取消"（默认）+ "删除"（红色）
   - 删除请求进行中时按钮显示 loading 状态

3. **状态管理**：
   - 新增 `deletingSessionId` 状态跟踪正在删除的 session
   - 新增 `confirmDeleteId` 状态跟踪待确认删除的 session
   - 删除成功后自动刷新列表（从 store 中移除即可）

## 数据流

```
用户点击 trash 图标 → 设置 confirmDeleteId → 弹出确认 Modal
用户点击"删除" → 设置 deletingSessionId → 调用 sessionStore.deleteSession()
→ api.deleteSession(id) → DELETE /api/sessions/{id}
→ VaultManager.delete_session() → shutil.rmtree()
→ 204 返回 → store 移除 session → UI 更新
```

## 错误处理

| 场景 | 后端响应 | 前端处理 |
|------|---------|---------|
| session 不存在 | 404 | 显示错误提示，刷新列表 |
| session 运行中 | 409 | 显示错误提示"该档案正在使用中" |
| 网络错误 | — | 显示错误提示，保持列表不变 |
