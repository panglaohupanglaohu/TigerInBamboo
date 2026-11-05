// Restricted data grammar, not a JavaScript evaluator. Unknown syntax fails closed.
export function parseLearningDeclaration(text,name){
 if(!['ARCH','PIPELINE','LEARN','REFACTOR_STATUS'].includes(name)||typeof text!=='string'||text.length>2*1024*1024)throw Error('学习声明输入无效');
 let i=0;
 const fail=()=>{throw Error('不支持的学习声明语法，位置 '+i);};
 function space(){while(i<text.length){if(/\s/.test(text[i])){i++;continue;}if(text.startsWith('//',i)){const end=text.indexOf('\n',i+2);i=end<0?text.length:end+1;continue;}if(text.startsWith('/*',i)){const end=text.indexOf('*/',i+2);if(end<0)fail();i=end+2;continue;}break;}}
 function token(value){space();if(!text.startsWith(value,i))fail();i+=value.length;}
 function string(){space();const quote=text[i++];let out='';while(i<text.length){const c=text[i++];if(c===quote)return out;if(c.charCodeAt(0)<32)fail();if(c!=='\\'){out+=c;continue;}const escape=text[i++],simple={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v',"'":"'",'"':'"','\\':'\\','/':'/'};if(Object.hasOwn(simple,escape)){out+=simple[escape];continue;}if(escape==='u'||escape==='x'){const count=escape==='u'?4:2,hex=text.slice(i,i+count);if(!new RegExp('^[0-9a-fA-F]{'+count+'}$').test(hex))fail();out+=String.fromCharCode(parseInt(hex,16));i+=count;continue;}fail();}fail();}
 function identifier(){space();const match=/^[A-Za-z_$][\w$]*/.exec(text.slice(i));if(!match)fail();i+=match[0].length;return match[0];}
 function value(depth=0){if(depth>64)fail();space();const c=text[i];if(c==='"'||c==="'")return string();
  if(c==='['||c==='{'){const array=c==='[',end=array?']':'}',result=array?[]:Object.create(null);i++;space();while(text[i]!==end){if(array)result.push(value(depth+1));else{const key=text[i]==='"'||text[i]==="'"?string():identifier();if(['__proto__','constructor','prototype'].includes(key)||Object.hasOwn(result,key))fail();token(':');result[key]=value(depth+1);}space();if(text[i]!==',')break;i++;space();}token(end);return result;}
  const number=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));if(number){i+=number[0].length;const n=Number(number[0]);if(!Number.isFinite(n))fail();return n;}
  const word=identifier();if(word==='true')return true;if(word==='false')return false;if(word==='null')return null;fail();
 }
 token('window');token('.');if(identifier()!==name)fail();token('=');const result=value();space();if(text[i]===';')i++;space();if(i!==text.length||!result||Array.isArray(result)||typeof result!=='object')fail();return result;
}
