import {mkdir,readFile,writeFile,rename} from 'node:fs/promises'
import {dirname} from 'node:path'
/** Serialize only configuration mutations; status requests never wait on disk. */
export class PromptStore<T> {
  private queue:Promise<unknown>=Promise.resolve()
  private file:string
  constructor(file:string){this.file=file}
  async read():Promise<T[]> {
    await this.queue
    return this.readFile()
  }
  private async readFile():Promise<T[]> {
    try {const value=JSON.parse(await readFile(this.file,'utf8'));if(!Array.isArray(value))throw new Error('快捷任务配置格式错误。');return value}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error}
  }
  update(change:(items:T[])=>void):Promise<T[]> {
    const result=this.queue.then(async()=>{
      const items=await this.readFile();change(items)
      await mkdir(dirname(this.file),{recursive:true,mode:0o700})
      await writeFile(this.file+'.tmp',JSON.stringify(items),{mode:0o600})
      await rename(this.file+'.tmp',this.file)
      return items
    })
    this.queue=result.catch(()=>{})
    return result
  }
}
