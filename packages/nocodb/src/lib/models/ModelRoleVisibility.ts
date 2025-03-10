import Noco from '../Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import { extractProps } from '../meta/helpers/extractProps';
import View from './View';
import type { ModelRoleVisibilityType } from 'nocodb-sdk';

export default class ModelRoleVisibility implements ModelRoleVisibilityType {
  id?: string;
  project_id?: string;
  base_id?: string;
  // fk_model_id?: string;
  fk_view_id?: string;
  role?: string;
  disabled?: boolean;

  constructor(body: Partial<ModelRoleVisibilityType>) {
    Object.assign(this, body);
  }

  static async list(projectId): Promise<ModelRoleVisibility[]> {
    let data = await NocoCache.getList(CacheScope.MODEL_ROLE_VISIBILITY, [
      projectId,
    ]);
    if (!data.length) {
      data = await Noco.ncMeta.metaList2(
        projectId,
        null,
        MetaTable.MODEL_ROLE_VISIBILITY
      );
      await NocoCache.setList(
        CacheScope.MODEL_ROLE_VISIBILITY,
        [projectId],
        data
      );
    }
    return data?.map((baseData) => new ModelRoleVisibility(baseData));
  }

  static async get(
    args: { role: string; fk_view_id: any },
    ncMeta = Noco.ncMeta
  ) {
    let data =
      args.fk_view_id &&
      args.role &&
      (await NocoCache.get(
        `${CacheScope.MODEL_ROLE_VISIBILITY}:${args.fk_view_id}:${args.role}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!data) {
      data = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.MODEL_ROLE_VISIBILITY,
        // args.fk_model_id
        //   ? {
        //       fk_model_id: args.fk_model_id,
        //       role: args.role
        //     }
        //   :
        {
          fk_view_id: args.fk_view_id,
          role: args.role,
        }
      );
      await NocoCache.set(
        `${CacheScope.MODEL_ROLE_VISIBILITY}:${args.fk_view_id}:${args.role}`,
        data
      );
    }
    return data && new ModelRoleVisibility(data);
  }

  static async update(
    fk_view_id: string,
    role: string,
    body: { disabled: any }
  ) {
    // get existing cache
    const key = `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o.disabled = body.disabled;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    return await Noco.ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        disabled: body.disabled,
      },
      {
        fk_view_id,
        role,
      }
    );
  }

  async delete() {
    return await ModelRoleVisibility.delete(this.fk_view_id, this.role);
  }
  static async delete(fk_view_id: string, role: string) {
    await NocoCache.deepDel(
      CacheScope.MODEL_ROLE_VISIBILITY,
      `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`,
      CacheDelDirection.CHILD_TO_PARENT
    );
    return await Noco.ncMeta.metaDelete(
      null,
      null,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        fk_view_id,
        role,
      }
    );
  }

  static async insert(
    body: Partial<ModelRoleVisibilityType>,
    ncMeta = Noco.ncMeta
  ) {
    const insertObj = extractProps(body, [
      'role',
      'disabled',
      'fk_view_id',
      'project_id',
      'base_id',
    ]);

    if (!(insertObj.project_id && insertObj.base_id)) {
      const view = await View.get(body.fk_view_id, ncMeta);
      insertObj.project_id = view.project_id;
      insertObj.base_id = view.base_id;
    }

    await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.MODEL_ROLE_VISIBILITY,
      insertObj
    );

    await NocoCache.appendToList(
      CacheScope.MODEL_ROLE_VISIBILITY,
      [insertObj.project_id],
      `${CacheScope.MODEL_ROLE_VISIBILITY}:${body.fk_view_id}:${body.role}`
    );

    return this.get(
      {
        fk_view_id: body.fk_view_id,
        role: body.role,
      },
      ncMeta
    );
  }
}
