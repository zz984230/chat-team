import { useUiStore } from '../../stores/uiStore';
import { useAgentStore } from '../../stores/agentStore';

const AGENT_NAMES: Record<string, string> = {
  analyst: '需求分析师',
  architect: '方案架构师',
  'dev-lead': '开发负责人',
  'test-lead': '测试负责人',
};

const AGENT_COLORS: Record<string, string> = {
  analyst: 'text-green-400',
  architect: 'text-blue-400',
  'dev-lead': 'text-orange-400',
  'test-lead': 'text-purple-400',
};

export function AgentDetailPanel() {
  const agentId = useUiStore((s) => s.agentDetailPanel);
  const close = useUiStore((s) => s.closeAgentDetail);
  const agentState = useAgentStore((s) => (agentId ? s.agents[agentId] : undefined));

  if (!agentId) return null;

  return (
    <div className="fixed top-0 right-0 z-50 h-full w-80 bg-gray-800 border-l border-gray-700 shadow-2xl transform transition-transform duration-300">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${AGENT_COLORS[agentId] ?? 'text-white'}`}>
            {AGENT_NAMES[agentId] ?? agentId}
          </h3>
          <button className="text-gray-400 hover:text-white" onClick={close}>
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <span className="text-gray-500">ID:</span>{' '}
            <span className="text-gray-300">{agentId}</span>
          </div>

          <div>
            <span className="text-gray-500">状态:</span>{' '}
            <span className="text-white">{agentState?.animationState ?? 'idle'}</span>
          </div>

          {agentState?.thinkingContent && (
            <div>
              <span className="text-gray-500">思考内容:</span>
              <p className="text-blue-300 mt-1 text-xs bg-gray-900 rounded p-2 max-h-40 overflow-y-auto">
                {agentState.thinkingContent}
              </p>
            </div>
          )}

          {agentState?.currentTool && (
            <div>
              <span className="text-gray-500">正在使用:</span>{' '}
              <span className="text-yellow-400">{agentState.currentTool}</span>
            </div>
          )}

          {agentState?.outputFiles && agentState.outputFiles.length > 0 && (
            <div>
              <span className="text-gray-500">产出文件:</span>
              <ul className="mt-1 space-y-1">
                {agentState.outputFiles.map((f) => (
                  <li key={f} className="text-green-400 text-xs">📄 {f}</li>
                ))}
              </ul>
            </div>
          )}

          {agentState?.errorMessage && (
            <div className="text-red-400 text-xs">错误: {agentState.errorMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}
