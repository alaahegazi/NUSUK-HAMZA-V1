import { requireSupabase } from './supabaseClient';
import type { AutomationTask, Group } from '../types';

type GroupRow = { id: string; name: string; created_at: string };
type PilgrimRow = {
  id: string;
  group_id: string | null;
  status: AutomationTask['status'];
  account_created: boolean;
  data: AutomationTask['data'];
  operation_logs: AutomationTask['logs'];
  created_at: string;
};

export const cloudDataService = {
  async load(userId: string): Promise<{ groups: Group[]; tasks: AutomationTask[] }> {
    const db = requireSupabase();
    const [groupResult, taskResult] = await Promise.all([
      db.from('agency_groups').select('id,name,created_at').eq('user_id', userId).order('created_at'),
      db.from('pilgrim_records').select('id,group_id,status,account_created,data,operation_logs,created_at').eq('user_id', userId).order('created_at')
    ]);
    if (groupResult.error) throw groupResult.error;
    if (taskResult.error) throw taskResult.error;
    return {
      groups: (groupResult.data ?? []).map((g: GroupRow) => ({ id: g.id, name: g.name, createdAt: g.created_at })),
      tasks: (taskResult.data ?? []).map((t: PilgrimRow) => ({
        id: t.id, groupId: t.group_id ?? undefined, status: t.status,
        accountCreated: t.account_created, data: t.data, logs: t.operation_logs ?? []
      }))
    };
  },

  async saveGroups(userId: string, groups: Group[]): Promise<void> {
    const db = requireSupabase();
    const cloudGroups = groups.filter(g => g.id !== 'general');
    if (!cloudGroups.length) return;
    const rows = cloudGroups.map(g => ({ id: g.id, user_id: userId, name: g.name, created_at: g.createdAt }));
    const { error } = await db.from('agency_groups').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  },

  async saveTasks(userId: string, tasks: AutomationTask[]): Promise<void> {
    const db = requireSupabase();
    if (!tasks.length) return;
    const rows = tasks.map(t => ({
      id: t.id, user_id: userId, group_id: t.groupId && t.groupId !== 'general' ? t.groupId : null,
      status: t.status, account_created: Boolean(t.accountCreated),
      data: t.data, operation_logs: t.logs ?? []
    }));
    const { error } = await db.from('pilgrim_records').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  },

  async recordEvent(userId: string, entityType: string, entityId: string | null, action: string, details: Record<string, unknown> = {}): Promise<void> {
    const db = requireSupabase();
    const safeDetails = { ...details };
    delete safeDetails.password;
    delete safeDetails.appPassword;
    delete safeDetails.otpCode;
    const { error } = await db.from('operation_audit').insert({
      user_id: userId, entity_type: entityType, entity_id: entityId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId) ? entityId : null, action, details: safeDetails
    });
    if (error) throw error;
  }
};
