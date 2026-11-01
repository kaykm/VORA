import {build} from './compilar.mjs';
try{const info=build();console.log(`VORA gerado: dist/VORA.html (${info.bytes.toLocaleString('pt-BR')} bytes, ${info.javascriptFiles} arquivos JS).`);console.log('Pode abrir o HTML diretamente, sem servidor e sem internet.');}
catch(error){console.error('Falha ao gerar:',error.message);process.exitCode=1;}
