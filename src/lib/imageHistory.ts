// Image versions use the existing SiteImage model, so current installations do
// not need a schema migration. They never enter the public image-key map.
export const IMAGE_HISTORY_GROUP = 'IMAGE_HISTORY';
const PREFIX = '__image_history/';

export function imageHistoryPrefix(imageId: number) {
  return `${PREFIX}${imageId}/`;
}

export function imageSnapshot(image: { id: number; name: string; url: string }) {
  return {
    key: `${imageHistoryPrefix(image.id)}${crypto.randomUUID()}`,
    group: IMAGE_HISTORY_GROUP,
    name: image.name,
    url: image.url,
  };
}

export function isHistoryOf(record: { group: string; key: string }, imageId: number) {
  return record.group === IMAGE_HISTORY_GROUP && record.key.startsWith(imageHistoryPrefix(imageId));
}
