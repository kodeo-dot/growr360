import { createClient } from "@supabase/supabase-js";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL??"";
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??"";

export async function requireGroupPermission(request:Request,groupId:string,permission:string){
  const authorization=request.headers.get("authorization")??"";
  if(!authorization.toLowerCase().startsWith("bearer ")) return {ok:false,status:401,error:"Sesión requerida"};
  if(!groupId) return {ok:false,status:400,error:"Grupo requerido"};
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
  const {data,error}=await client.rpc("has_group_permission",{p_group_id:groupId,p_permission:permission});
  if(error) return {ok:false,status:403,error:"No se pudo validar tu permiso"};
  if(!data) return {ok:false,status:403,error:"No tenés permiso para usar esta función"};
  return {ok:true,status:200,error:""};
}
