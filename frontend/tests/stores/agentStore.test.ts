import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentStore } from '../../src/stores/agentStore';

describe('agentStore', () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: {},
    });
  });

  it('updates agent state on thinking event', () => {
    useAgentStore.getState().handleEvent({ type: 'agent:thinking', agent_id: 'analyst', content: '分析需求...' });
    const agent = useAgentStore.getState().agents['analyst'];
    expect(agent).toBeDefined();
    expect(agent?.animationState).toBe('thinking');
    expect(agent?.thinkingContent).toBe('分析需求...');
  });

  it('updates agent state on working event', () => {
    useAgentStore.getState().handleEvent({ type: 'agent:working', agent_id: 'architect', tool: 'Write' });
    const agent = useAgentStore.getState().agents['architect'];
    expect(agent?.animationState).toBe('working');
  });

  it('updates agent state on completed event', () => {
    useAgentStore.getState().handleEvent({ type: 'agent:completed', agent_id: 'analyst', duration_ms: 5000 });
    const agent = useAgentStore.getState().agents['analyst'];
    expect(agent?.animationState).toBe('idle');
  });

  it('appends output file on output event', () => {
    useAgentStore.getState().handleEvent({ type: 'agent:output', agent_id: 'analyst', file: '01-需求澄清.md' });
    const agent = useAgentStore.getState().agents['analyst'];
    expect(agent?.outputFiles).toContain('01-需求澄清.md');
  });
});
