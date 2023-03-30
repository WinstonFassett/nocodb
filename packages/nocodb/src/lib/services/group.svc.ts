import { T } from 'nc-help';
import { validatePayload } from '../meta/api/helpers';
import Group from '../models/Group';
import type { GroupReqType } from 'nocodb-sdk';

export async function groupGet(param: { groupId: string }) {
  return Group.get(param.groupId);
}

export async function groupDelete(param: { groupId: string }) {
  await Group.delete(param.groupId);
  T.emit('evt', { evt_type: 'group:deleted' });
  return true;
}

export async function groupUpdate(param: { groupId: any; group: GroupReqType }) {
  validatePayload('swagger.json#/components/schemas/GroupReq', param.group);

  const group = await Group.update(param.groupId, param.group);
  T.emit('evt', { evt_type: 'group:updated' });
  return group;
}

export async function groupCreate(param: { viewId: any; group: GroupReqType }) {
  validatePayload('swagger.json#/components/schemas/GroupReq', param.group);

  const group = await Group.insert({
    ...param.group,
    fk_view_id: param.viewId,
  } as Group);
  T.emit('evt', { evt_type: 'group:created' });
  return group;
}

export async function groupList(param: { viewId: string }) {
  return Group.list({ viewId: param.viewId });
}
