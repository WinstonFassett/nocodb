import path from 'path';
import { nanoid } from 'nanoid';
import slash from 'slash';
import { T } from 'nc-help';
import mimetypes, { mimeIcons } from '../utils/mimeTypes';
import NcPluginMgrv2 from '../meta/helpers/NcPluginMgrv2';
import Local from '../v1-legacy/plugins/adapters/storage/Local';

export async function upload(param: {
  path?: string;
  // todo: proper type
  files: unknown[];
}) {
  // TODO: add getAjvValidatorMw
  const filePath = sanitizeUrlPath(param.path?.toString()?.split('/') || ['']);
  const destPath = path.join('nc', 'uploads', ...filePath);

  const storageAdapter = await NcPluginMgrv2.storageAdapter();

  const attachments = await Promise.all(
    param.files?.map(async (file: any) => {
      const fileName = `${nanoid(18)}${path.extname(file.originalname)}`;

      const url = await storageAdapter.fileCreate(
        slash(path.join(destPath, fileName)),
        file
      );

      let attachmentPath;

      // if `url` is null, then it is local attachment
      if (!url) {
        // then store the attachement path only
        // url will be constructued in `useAttachmentCell`
        attachmentPath = `download/${filePath.join('/')}/${fileName}`;
      }

      return {
        ...(url ? { url } : {}),
        ...(attachmentPath ? { path: attachmentPath } : {}),
        title: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        icon: mimeIcons[path.extname(file.originalname).slice(1)] || undefined,
      };
    })
  );

  T.emit('evt', { evt_type: 'image:uploaded' });

  return attachments;
}

export async function uploadViaURL(param: {
  path?: string;
  urls: {
    url: string;
    fileName: string;
    mimetype?: string;
    size?: string | number;
  }[];
}) {
  // TODO: add getAjvValidatorMw
  const filePath = sanitizeUrlPath(param?.path?.toString()?.split('/') || ['']);
  const destPath = path.join('nc', 'uploads', ...filePath);

  const storageAdapter = await NcPluginMgrv2.storageAdapter();

  const attachments = await Promise.all(
    param.urls?.map?.(async (urlMeta) => {
      const { url, fileName: _fileName } = urlMeta;

      const fileName = `${nanoid(18)}${_fileName || url.split('/').pop()}`;

      const attachmentUrl = await (storageAdapter as any).fileCreateByUrl(
        slash(path.join(destPath, fileName)),
        url
      );

      let attachmentPath;

      // if `attachmentUrl` is null, then it is local attachment
      if (!attachmentUrl) {
        // then store the attachement path only
        // url will be constructued in `useAttachmentCell`
        attachmentPath = `download/${filePath.join('/')}/${fileName}`;
      }

      return {
        ...(attachmentUrl ? { url: attachmentUrl } : {}),
        ...(attachmentPath ? { path: attachmentPath } : {}),
        title: fileName,
        mimetype: urlMeta.mimetype,
        size: urlMeta.size,
        icon: mimeIcons[path.extname(fileName).slice(1)] || undefined,
      };
    })
  );

  T.emit('evt', { evt_type: 'image:uploaded' });

  return attachments;
}

export async function fileRead(param: { path: string }) {
  // get the local storage adapter to display local attachments
  const storageAdapter = new Local();
  const type =
    mimetypes[path.extname(param.path).split('/').pop().slice(1)] ||
    'text/plain';

  const img = await storageAdapter.fileRead(slash(param.path));
  return { img, type };
}

export function sanitizeUrlPath(paths) {
  return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
}
