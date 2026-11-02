// Prevent a hidden archived article from being exposed through its static HTML/JSON fallback.
type Context={request:Request;env:{PUBLIC_SUPABASE_URL?:string;PUBLIC_SUPABASE_ANON_KEY?:string};next:()=>Promise<Response>};
export async function onRequest(context:Context){
 const path=new URL(context.request.url).pathname;
 const post=path.match(/^\/posts\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
 const page=path.match(/^\/church\/([a-z0-9-]+)\/?$/);
 const catalog=path.match(/^\/cms\/records\/((?:page|post)-[a-z0-9-]+)\.json$/);
 const aliases:Record<string,string>={'/about/':'page-2','/services/':'page-7','/contact/':'page-8'};
 const key=post?`post-${post[1]}-${post[2]}`:page?`page-${page[1]}`:catalog?catalog[1]:aliases[path];
 if(!key)return context.next();
 const {PUBLIC_SUPABASE_URL:base,PUBLIC_SUPABASE_ANON_KEY:apiKey}=context.env;
 if(!base||!apiKey)return context.next();
 try{
  const response=await fetch(base+'/rest/v1/rpc/read_church_content',{method:'POST',headers:{apikey:apiKey,'Content-Type':'application/json'},body:JSON.stringify({requested_keys:[key]})});
  if(!response.ok)return new Response('자료 연결을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.',{status:503,headers:{'Cache-Control':'no-store'}});
  const data=await response.json() as {hidden?:boolean}[];
  if(data[0]?.hidden){
   const authorization=context.request.headers.get('Authorization');
   if(authorization?.startsWith('Bearer ')){const admin=await fetch(base+'/rest/v1/rpc/is_church_admin',{method:'POST',headers:{apikey:apiKey,Authorization:authorization,'Content-Type':'application/json'},body:'{}'});if(admin.ok&&await admin.json()===true)return context.next();}
   return new Response('공개된 자료를 찾지 못했습니다.',{status:404,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
  }
 }catch{return new Response('자료 연결을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.',{status:503,headers:{'Cache-Control':'no-store'}});}
 return context.next();
}
