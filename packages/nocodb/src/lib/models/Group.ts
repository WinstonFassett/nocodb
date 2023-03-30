import Noco from '../Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import { extractProps } from '../meta/helpers/extractProps';
import Model from './Model';
import Column from './Column';
import type { GroupType } from 'nocodb-sdk';

export default class Group {
  id: string;

  fk_view_id: string;
  fk_column_id?: string;
  direction?: 'asc' | 'desc';
  project_id?: string;
  base_id?: string;

  constructor(data: Partial<GroupType>) {
    Object.assign(this, data);
  }

  public static async deleteAll(viewId: string, ncMeta = Noco.ncMeta) {
    await NocoCache.deepDel(
      CacheScope.GROUP,
      `${CacheScope.GROUP}:${viewId}`,
      CacheDelDirection.PARENT_TO_CHILD
    );
    await ncMeta.metaDelete(null, null, MetaTable.GROUP, {
      fk_view_id: viewId,
    });
  }

  public static async insert(
    groupObj: Partial<Group> & { push_to_top?: boolean; order?: number },
    ncMeta = Noco.ncMeta
  ) {
    const insertObj = extractProps(groupObj, [
      'id',
      'fk_view_id',
      'fk_column_id',
      'direction',
      'project_id',
      'base_id',
    ]);

    // todo: implement a generic function
    insertObj.order = groupObj.push_to_top
      ? 1
      : (+(
          await ncMeta
            .knex(MetaTable.GROUP)
            .max('order', { as: 'order' })
            .where({
              fk_view_id: groupObj.fk_view_id,
            })
            .first()
        )?.order || 0) + 1;
    if (!(groupObj.project_id && groupObj.base_id)) {
      const model = await Column.get({ colId: groupObj.fk_column_id }, ncMeta);
      insertObj.project_id = model.project_id;
      insertObj.base_id = model.base_id;
    }

    // increment existing order
    if (groupObj.push_to_top) {
      await ncMeta
        .knex(MetaTable.GROUP)
        .where({
          fk_view_id: groupObj.fk_view_id,
        })
        .increment('order', 1);
    }

    const row = await ncMeta.metaInsert2(null, null, MetaTable.GROUP, insertObj);
    if (groupObj.push_to_top) {
      // todo: delete cache
      const groupList = await ncMeta.metaList2(null, null, MetaTable.GROUP, {
        condition: { fk_view_id: groupObj.fk_view_id },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(CacheScope.GROUP, [groupObj.fk_view_id], groupList);
    } else {
      await NocoCache.appendToList(
        CacheScope.GROUP,
        [groupObj.fk_view_id],
        `${CacheScope.GROUP}:${row.id}`
      );

      await NocoCache.appendToList(
        CacheScope.GROUP,
        [groupObj.fk_column_id],
        `${CacheScope.GROUP}:${row.id}`
      );
    }
    return this.get(row.id, ncMeta);
  }

  public getColumn(): Promise<Column> {
    if (!this.fk_column_id) return null;
    return Column.get({
      colId: this.fk_column_id,
    });
  }

  public static async list(
    { viewId }: { viewId: string },
    ncMeta = Noco.ncMeta
  ): Promise<Group[]> {
    if (!viewId) return null;
    let groupList = await NocoCache.getList(CacheScope.GROUP, [viewId]);
    if (!groupList.length) {
      groupList = await ncMeta.metaList2(null, null, MetaTable.GROUP, {
        condition: { fk_view_id: viewId },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(CacheScope.GROUP, [viewId], groupList);
    }
    groupList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity)
    );
    return groupList.map((s) => new Group(s));
  }

  public static async update(groupId, body, ncMeta = Noco.ncMeta) {
    // get existing cache
    const key = `${CacheScope.GROUP}:${groupId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update fk_column_id & direction
      o.fk_column_id = body.fk_column_id;
      o.direction = body.direction;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.GROUP,
      {
        fk_column_id: body.fk_column_id,
        direction: body.direction,
      },
      groupId
    );
  }

  public static async delete(groupId: string, ncMeta = Noco.ncMeta) {
    await NocoCache.deepDel(
      CacheScope.GROUP,
      `${CacheScope.GROUP}:${groupId}`,
      CacheDelDirection.CHILD_TO_PARENT
    );
    await ncMeta.metaDelete(null, null, MetaTable.GROUP, groupId);
  }

  public static async get(id: any, ncMeta = Noco.ncMeta) {
    let groupData =
      id &&
      (await NocoCache.get(
        `${CacheScope.GROUP}:${id}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!groupData) {
      groupData = await ncMeta.metaGet2(null, null, MetaTable.GROUP, id);
      await NocoCache.set(`${CacheScope.GROUP}:${id}`, groupData);
    }
    return groupData && new Group(groupData);
  }

  public async getModel(ncMeta = Noco.ncMeta): Promise<Model> {
    return Model.getByIdOrName(
      {
        id: this.fk_view_id,
      },
      ncMeta
    );
  }
}

export interface GroupObject {
  id?: string;
  fk_view_id: string;
  fk_column_id?: string;
  direction?: 'asc' | 'desc';
}
