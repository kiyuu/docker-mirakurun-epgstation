const spawn = require('child_process').spawn;
const execFile = require('child_process').execFile;
const ffmpeg = process.env.FFMPEG;
const ffprobe = process.env.FFPROBE;
const path = require('path');

const input = process.env.INPUT;
const output = process.env.OUTPUT;
const videoHeight = parseInt(process.env.VIDEORESOLUTION, 10);
const isDualMono = parseInt(process.env.AUDIOCOMPONENTTYPE, 10) == 2;
const output_name = path.basename(output, path.extname(output));
const output_dir = path.dirname(output);

//FFmpegオプション生成 ここから
const args = ['-y'];
const bitrate = '5M';

// 字幕用
Array.prototype.push.apply(args, ['-fix_sub_duration']);
// input 設定
Array.prototype.push.apply(args, ['-i', input]);
// ビデオストリーム設定
Array.prototype.push.apply(args, ['-map', '0:v', '-c:v', 'h264_v4l2m2m']);
// インターレス解除
Array.prototype.push.apply(args, ['-vf', 'fieldmatch -movflags +faststart']);
// オーディオストリーム設定
if (isDualMono) {
    Array.prototype.push.apply(args, [
        '-filter_complex',
        'channelsplit[FL][FR]',
        '-map', '[FL]',
        '-map', '[FR]',
        '-metadata:s:a:0', 'language=jpn',
        '-metadata:s:a:1', 'language=eng',
    ]);
} else {
    Array.prototype.push.apply(args, ['-map', '0:a']);
}
Array.prototype.push.apply(args, ['-c:a', 'aac']);
// 字幕ストリーム設定
Array.prototype.push.apply(args, ['-map', '0:s?', '-c:s', 'mov_text']);
// 品質設定
Array.prototype.push.apply(args, ['-preset', 'veryfast', '-crf', '26', '-b:v', bitrate, '-aspect', '16:9', '-f', 'mp4']);
Array.prototype.push.apply(args, ['-ignore_unknown']);

let str = '';
for (let i of args) {
    str += ` ${i}`;
}
// console.error(str);  //オプションを確認するときコメントアウトを外す
//FFmpegオプション生成 ここまで

/**
 * 動画長取得関数
 * @param {string} filePath ファイルパス
 * @return number 動画長を返す (秒)
 */
const getDuration = filePath => {
    return new Promise((resolve, reject) => {
        execFile(ffprobe, ['-v', '0', '-show_format', '-of', 'json', filePath], (err, stdout) => {
            if (err) {
                reject(err);

                return;
            }

            try {
                const result = JSON.parse(stdout);
                resolve(parseFloat(result.format.duration));
            } catch (err) {
                reject(err);
            }
        });
    });
};


//メインの処理 ここから
(async () => {
    // 進捗計算のために動画の長さを取得
    const duration = await getDuration(input);

    //必要な変数
    let total_num = 0;
    let now_num = 0;
    let avisynth_flag = false;
    let percent = 0;
    let update_log_flag = false;
    let log = '';

    const jlse_args = ['-i', input, '-e', '-o', str,'-r','-d', output_dir, '-n', output_name];
    console.error(jlse_args);
    
    var env = Object.create( process.env );
    env.HOME = '/root';
    console.error(env);
    const child = spawn('jlse', jlse_args, {env:env, detached: true});

    let inputfileinfo = false;
    let outputfileinfo = false;
    let fileinfolog = '';

    /**
     * エンコード進捗表示用に標準出力に進捗情報を吐き出す
     * 出力する JSON
     * {"type":"progress","percent": 0.8, "log": "view log" }
     */
    child.stderr.on('data', data => {
        let strbyline = String(data).split('\n');
        for (let i = 0; i < strbyline.length; i++) {
            let str = strbyline[i];
            switch(str){
              case str.startsWith('AviSynth') && str :{  //AviSynth+
                const raw_avisynth_data = str.replace(/AviSynth\s/,'');
                if(raw_avisynth_data.startsWith('Creating')){
                  const avisynth_reg = /Creating\slwi\sindex\sfile\s(\d+)%/;
                  total_num = 200;
                  now_num = Number(raw_avisynth_data.match(avisynth_reg)[1]);
                  now_num += avisynth_flag ? 100 : 0;
                  avisynth_flag = avisynth_flag ? true : now_num == 100 ? true : false ;
                }
                update_log_flag = true;
                log = `(1/4) AviSynth:Creating lwi index files`;
                break;
              }

              case str.startsWith('chapter_exe') && str :{  //chapter_exe
                const raw_chapter_exe_data = str.replace(/chapter_exe\s/,'');
                switch(raw_chapter_exe_data){
                  case raw_chapter_exe_data.startsWith('\tVideo Frames') && raw_chapter_exe_data :{ 
                    //chapter_exeでの総フレーム数取得
                    const movie_frame_reg = /\tVideo\sFrames:\s(\d+)\s\[\d+\.\d+fps\]/;
                    total_num = Number(raw_chapter_exe_data.match(movie_frame_reg)[1]);
                    update_log_flag = true;
                    break;
                  }
                  case raw_chapter_exe_data.startsWith('mute') && raw_chapter_exe_data :{
                    //現在のフレーム数取得
                    const chapter_reg = /mute\s?\d+:\s(\d+)\s\-\s\d+フレーム/;
                    now_num = Number(raw_chapter_exe_data.match(chapter_reg)[1]);
                    update_log_flag = true;
                    break;
                  }
                  case raw_chapter_exe_data.startsWith('end') && raw_chapter_exe_data :{
                    //chapter_exeの終了検知
                    now_num = total_num;
                    update_log_flag = true;
                    break;
                  }
                  default :{
                    break;
                  }
                }
                log = `(2/4) Chapter_exe: ${now_num}/${total_num}`;
                break;
              }

              case str.startsWith('logoframe') && str:{ //logoframe
                const raw_logoframe_data = str.replace(/logoframe\s/,'');
                switch (raw_logoframe_data){
                  case raw_logoframe_data.startsWith('checking') && raw_logoframe_data :{
                    const logoframe_reg = /checking\s*(\d+)\/(\d+)\sended./;
                    const logoframe = raw_logoframe_data.match(logoframe_reg);
                    now_num = Number(logoframe[1]);
                    total_num = Number(logoframe[2]);
                    update_log_flag = true;
                  }
                  default :{
                    break;
                  }
                }
                log = `(3/4) logoframe: ${now_num}/${total_num}`;
                break;
              }

              case str.startsWith('frame') && str:{ //FFmpeg
                // 想定log
                // frame= 2847 fps=0.0 q=-1.0 Lsize=  216432kB time=00:01:35.64 bitrate=18537.1kbits/s speed= 222x
                const progress = {};
                const ffmpeg_reg = /frame=\s*(?<frame>\d+)\sfps=\s*(?<fps>\d+(?:\.\d+)?)\sq=\s*(?<q>[+-]?\d+(?:\.\d+)?)\sL?size=\s*(?<size>\d+(?:\.\d+)?)kB\stime=\s*(?<time>\d+[:\.\d+]*)\sbitrate=\s*(?<bitrate>\d+(?:\.\d+)?)kbits\/s(?:\sdup=\s*(?<dup>\d+))?(?:\sdrop=\s*(?<drop>\d+))?\sspeed=\s*(?<speed>\d+(?:\.\d+)?)x/;
                let ffmatch =str.match(ffmpeg_reg);
                /**
                 * match結果
                 * [
                 *   'frame= 5159 fps= 11 q=29.0 size=  122624kB time=00:02:51.84 bitrate=5845.8kbits/s dup=19 drop=0 speed=0.372x',
                 *   '5159',
                 *   '11',
                 *   '29.0',
                 *   '122624',
                 *   '00:02:51.84',
                 *   '5845.8',
                 *   '19',
                 *   '0',
                 *   '0.372',
                 *   index: 0,
                 *   input: 'frame= 5159 fps= 11 q=29.0 size=  122624kB time=00:02:51.84 bitrate=5845.8kbits/s dup=19 drop=0 speed=0.372x    \r',
                 *   groups: [Object: null prototype] {
                 *     frame: '5159',
                 *     fps: '11',
                 *     q: '29.0',
                 *     size: '122624',
                 *     time: '00:02:51.84',
                 *     bitrate: '5845.8',
                 *     dup: '19',
                 *     drop: '0',
                 *     speed: '0.372'
                 *   }
                 * ]
                 */

                if (ffmatch === null) continue;

                progress['frame'] = parseInt(ffmatch.groups.frame);
                progress['fps'] = parseFloat(ffmatch.groups.fps);
                progress['q'] = parseFloat(ffmatch.groups.q);
                progress['size'] = parseInt(ffmatch.groups.size);
                progress['time'] = ffmatch.groups.time;
                progress['bitrate'] = parseFloat(ffmatch.groups.bitrate);
                progress['dup'] = ffmatch.groups.dup == null ? 0 : parseInt(ffmatch.groups.dup);
                progress['drop'] = ffmatch.groups.drop == null ? 0 : parseInt(ffmatch.groups.drop);
                progress['speed'] = parseFloat(ffmatch.groups.speed);

                let current = 0;
                const times = progress.time.split(':');
                for (let i = 0; i < times.length; i++) {
                    if (i == 0) {
                        current += parseFloat(times[i]) * 3600;
                    } else if (i == 1) {
                        current += parseFloat(times[i]) * 60;
                    } else if (i == 2) {
                        current += parseFloat(times[i]);
                    }
                }

                // 進捗率 1.0 で 100%
                now_num = current;
                total_num = duration;
                log =
                    '(4/4) FFmpeg: ' +
                    'frame= ' +
                    progress.frame +
                    ' fps=' +
                    progress.fps +
                    ' size=' +
                    progress.size +
                    ' time=' +
                    progress.time +
                    ' bitrate=' +
                    progress.bitrate +
                    ' drop=' +
                    progress.drop +
                    ' speed=' +
                    progress.speed;
                    update_log_flag = true;
                    break;
                  }

                  default:{ //進捗表示に必要ない出力データを流す
                    console.log(strbyline[i]);
                    break;
                  }
                }
                percent = now_num / total_num;
                if(update_log_flag) console.log(JSON.stringify({ type: 'progress', percent: percent, log: log }));
                update_log_flag = false;
        }
    });

    child.on('error', err => {
        console.error(err);
        throw new Error(err);
    });

    process.on('SIGINT', () => {
      process.kill(-child.pid, 'SIGINT');
    });

    child.on('close', code => {
      //終了後にしたい処理があれば書く
    });
})();
