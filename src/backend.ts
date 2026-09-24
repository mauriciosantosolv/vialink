import {createClient,FunctionsHttpError} from '@supabase/supabase-js';
const runtime=(window as Window & {__VIALINK_CONFIG__?:{supabaseUrl?:string;supabaseAnonKey?:string}}).__VIALINK_CONFIG__;
const url=runtime?.supabaseUrl||import.meta.env.VITE_SUPABASE_URL;
const anon=runtime?.supabaseAnonKey||import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured=Boolean(url&&anon);
export const supabase=createClient(url||'https://example.supabase.co',anon||'missing',{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
async function unpack(error:any):Promise<never>{
 if(error instanceof FunctionsHttpError){const response=error.context as Response;let data:any={};try{data=await response.json()}catch{}const err=new Error(data.error||'Falha na operação.') as Error&{status?:number};err.status=response.status;throw err;}
 throw new Error(error?.message||'Não foi possível conectar.');
}
export async function fleetRequest(method:'GET'|'POST',body?:any){
 const {data,error}=await supabase.functions.invoke('fleet',{method,...(body?{body}:{})});
 if(error)await unpack(error);
 return data;
}
export async function uploadEvidence(file:File,org:string,user:string){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8388608)throw new Error('Use JPG, PNG ou WebP de até 8 MB.');
 const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
 const path=`${org}/${user}/${crypto.randomUUID()}.${ext}`;
 const {error}=await supabase.storage.from('vialink-evidence').upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw error;
 return path;
}
export async function signedEvidence(path:string){
 const {data,error}=await supabase.storage.from('vialink-evidence').createSignedUrl(path,600);
 if(error)throw error;
 return data.signedUrl;
}
