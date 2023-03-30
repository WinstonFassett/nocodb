import { Router } from 'express';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { groupService } from '../services';
import type { GroupListType, GroupReqType } from 'nocodb-sdk';
import type { Request, Response } from 'express';

export async function groupList(
  req: Request<any, any, any>,
  res: Response<GroupListType>
) {
  res.json(
    new PagedResponseImpl(
      await groupService.groupList({
        viewId: req.params.viewId,
      })
    )
  );
}

export async function groupCreate(req: Request<any, any, GroupReqType>, res) {
  const group = await groupService.groupCreate({
    group: req.body,
    viewId: req.params.viewId,
  });
  res.json(group);
}

export async function groupUpdate(req, res) {
  const group = await groupService.groupUpdate({
    groupId: req.params.groupId,
    group: req.body,
  });
  res.json(group);
}

export async function groupDelete(req: Request, res: Response) {
  const group = await groupService.groupDelete({
    groupId: req.params.groupId,
  });
  res.json(group);
}

export async function groupGet(req: Request, res: Response) {
  const group = await groupService.groupGet({
    groupId: req.params.groupId,
  });
  res.json(group);
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/views/:viewId/groups/',
  metaApiMetrics,
  ncMetaAclMw(groupList, 'groupList')
);
router.post(
  '/api/v1/db/meta/views/:viewId/groups/',
  metaApiMetrics,
  ncMetaAclMw(groupCreate, 'groupCreate')
);

router.get(
  '/api/v1/db/meta/groups/:groupId',
  metaApiMetrics,
  ncMetaAclMw(groupGet, 'groupGet')
);

router.patch(
  '/api/v1/db/meta/groups/:groupId',
  metaApiMetrics,
  ncMetaAclMw(groupUpdate, 'groupUpdate')
);
router.delete(
  '/api/v1/db/meta/groups/:groupId',
  metaApiMetrics,
  ncMetaAclMw(groupDelete, 'groupDelete')
);
export default router;
