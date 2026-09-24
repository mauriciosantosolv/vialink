import {createClient} from 'npm:@supabase/supabase-js@2';
import {transition} from '../_shared/domain.ts';

const url=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean);
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
function cors(origin:string|null){return {'Access-Control-Allow-Origin':origin&&allowed.includes(origin)?origin:'null','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Vary':'Origin','Cache-Control':'no-store'};}
function answer(body:unknown,status:number,origin:string|null){return Response.json(body,{status,headers:cors(origin)});}

Deno.serve(async request=>{
 const origin=request.headers.get('origin');
 if(origin&&!allowed.includes(origin))return answer({error:'Origem não autorizada.'},403,origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(!['GET','POST'].includes(request.method))return answer({error:'Método inválido.'},405,origin);
 try{
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return answer({error:'Faça login.'},401,origin);
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return answer({error:'Sessão inválida.'},401,origin);
  const {data:profile,error:profileError}=await admin.from('profiles').select('organization_id,name,role,driver_name').eq('user_id',user.id).single();
  if(profileError||!profile)return answer({error:'Conta ainda não vinculada a uma empresa. Solicite ao administrador.'},403,origin);
  const org=profile.organization_id;
  if(request.method==='GET'){
   const {data:row,error}=await admin.from('fleet_states').select('version,data').eq('organization_id',org).single();
   if(error||!row)throw new Error('Frota indisponível.');
   return answer({state:{...row.data,role:profile.role,driver:profile.driver_name||'',userName:profile.name},version:row.version,organizationId:org},200,origin);
  }
  if(Number(request.headers.get('content-length')||0)>100000) return answer({error:'Requisição muito grande.'},413,origin);
  const input=await request.json();
  if(input.action==='invite'){
   if(profile.role!=='Administrador')return answer({error:'Somente administradores podem convidar.'},403,origin);
   const email=String(input.email||'').toLowerCase().trim();const name=String(input.name||'').trim();
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||name.length<2||name.length>100||!['Administrador','Gestor de Frota','Supervisor','Condutor'].includes(input.role))return answer({error:'Dados do convite inválidos.'},400,origin);
   const {data:row}=await admin.from('fleet_states').select('data').eq('organization_id',org).single();
   if(input.role==='Condutor'&&!row?.data?.drivers?.includes(input.driver))return answer({error:'Cadastre o condutor antes de convidar.'},400,origin);
   if(input.role==='Condutor'){
    const {data:existing}=await admin.from('profiles').select('user_id').eq('organization_id',org).eq('driver_name',input.driver).maybeSingle();
    if(existing)return answer({error:'Condutor já vinculado a outra conta.'},409,origin);
   }
   const redirectTo=allowed[0];
   const {data:invitation,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:{name}});
   if(inviteError||!invitation.user)throw new Error(inviteError?.message||'Convite indisponível.');
   const {error:memberError}=await admin.from('profiles').insert({user_id:invitation.user.id,organization_id:org,name,role:input.role,driver_name:input.role==='Condutor'?input.driver:null});
   if(memberError)throw new Error('Convite enviado, mas vínculo pendente: '+memberError.message);
   return answer({ok:true},200,origin);
  }
  if(!Number.isSafeInteger(input.version)||typeof input.action!=='string')return answer({error:'Registro inválido.'},400,origin);
  const {data:row,error:readError}=await admin.from('fleet_states').select('version,data').eq('organization_id',org).single();
  if(readError||!row)throw new Error('Frota indisponível.');
  if(row.version!==input.version)return answer({error:'Outro registro foi salvo. Atualize e tente novamente.'},409,origin);
  const actor={id:user.id,role:profile.role,driver:profile.driver_name||'',name:profile.name};
  const state=transition(row.data,input,actor);
  const paths=[...Object.values(input.photos||{}),input.photo,input.receipt].filter(Boolean);
  for(const path of paths){
   if(typeof path!=='string'||!new RegExp('^'+org+'/'+user.id+'/[0-9a-f-]{36}\\.(jpg|png|webp)$').test(path))return answer({error:'Evidência não pertence a esta conta.'},400,origin);
   const folder=`${org}/${user.id}`;const filename=path.slice(folder.length+1);
   const {data:objects,error:photoError}=await admin.storage.from('vialink-evidence').list(folder,{search:filename,limit:100});
   if(photoError||!objects?.some(x=>x.name===filename))return answer({error:'Foto não encontrada.'},400,origin);
  }
  const {data:version,error:commitError}=await admin.rpc('commit_fleet_state',{p_org:org,p_expected:row.version,p_data:state,p_actor:user.id,p_action:input.action});
  if(commitError){if(commitError.message.includes('CONFLICT'))return answer({error:'Outro registro foi salvo. Atualize e tente novamente.'},409,origin);throw commitError;}
  return answer({state:{...state,role:profile.role,driver:profile.driver_name||'',userName:profile.name},version},200,origin);
 }catch(e){return answer({error:e instanceof Error?e.message:'Não foi possível concluir.'},400,origin);}
});
