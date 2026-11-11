// 공개 페이지에서 관리자가 저장한 최신 내용을 읽어 화면에 반영한다.
// 저장된 본문은 텍스트로만 넣고, 원본의 사진·영상 요소는 그대로 유지한다.
import { membershipClient } from './membership';
import { resolveMediaUrl } from './online-cms';

type LiveFile = { name: string; url: string; mime?: string };
type LiveRecord = {
  title?: string; bodyText?: string; replaceBody?: boolean; hidden?: boolean; addedFiles?: LiveFile[];
};

function appendFile(container: HTMLElement, name: string, url: string) {
  const type = /\.mp4$/i.test(name) ? 'video' : /\.(jpe?g|png|webp|gif)$/i.test(name) ? 'image' : 'file';
  if (type === 'video') {
    const video = document.createElement('video');
    video.src = url; video.controls = true; video.preload = 'metadata'; video.playsInline = true;
    video.style.maxWidth = '100%';
    container.append(video);
  } else if (type === 'image') {
    const image = document.createElement('img');
    image.src = url; image.alt = name; image.loading = 'lazy'; image.style.maxWidth = '100%';
    container.append(image);
  } else {
    const link = document.createElement('a');
    link.href = url; link.textContent = name; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const item = document.createElement('p'); item.append(link);
    container.append(item);
  }
}

export async function applyLiveContent(key: string, titleElement: HTMLElement | null, body: HTMLElement) {
  try {
    const client = await membershipClient();
    if (!client) return;
    const { data, error } = await client.rpc('read_church_content', { requested_keys: [key] });
    if (error || !Array.isArray(data) || !data[0]) return;
    const record = data[0] as LiveRecord;
    if (record.hidden) return;

    if (titleElement && record.title) titleElement.textContent = record.title;

    if (record.replaceBody !== false && typeof record.bodyText === 'string') {
      // 원본 사진·영상·iframe 은 본문이 바뀌어도 그대로 남긴다.
      const media = [...body.querySelectorAll('.video-sources,img,video,iframe,audio,a[href*="/onmam-assets/"]')].map(node => node.cloneNode(true) as HTMLElement);
      body.replaceChildren();
      for (const line of record.bodyText.split('\n')) {
        const paragraph = document.createElement('p');
        paragraph.textContent = line || ' ';
        body.append(paragraph);
      }
      body.append(...media);
    }

    for (const file of record.addedFiles ?? []) {
      const url = await resolveMediaUrl(file.url);
      if (url) appendFile(body, file.name, url);
    }
  } catch {
    // 연결이 안 되면 정적 내용을 그대로 보여 준다.
  }
}
