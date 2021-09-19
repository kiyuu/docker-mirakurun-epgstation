FROM l3tnun/epgstation:master-debian 
ENV DEV="make gcc git g++ automake curl wget autoconf build-essential libfreetype6-dev libsdl1.2-dev libtheora-dev libtool libva-dev libvdpau-dev libvorbis-dev libxcb1-dev libxcb-shm0-dev libxcb-xfixes0-dev pkg-config texinfo zlib1g-dev"

RUN set -xe && \
    apt-get update && \
    apt-get install --no-install-recommends -y \
       curl git make gcc g++ build-essential cmake ninja-build libmp3lame-dev libopus-dev libvorbis-dev libvpx-dev libx265-dev libx264-dev libaribb24-dev libass-dev libxft-dev libavcodec-dev libavformat-dev libswscale-dev libatomic-ops-dev automake libtool autoconf nodejs && \
    apt-get install --no-install-recommends -y \
       meson npm && \
\
# fdk
\
    cd /tmp/ && \
    git clone https://github.com/mstorsjo/fdk-aac.git && \
    cd fdk-aac && \
    ./autogen.sh && \
    ./configure && \
    make -j4 && \
    make install  && \
    /sbin/ldconfig && \
\
# l-smash
\
    cd /tmp/ && \
    git clone https://github.com/l-smash/l-smash.git && \
    cd l-smash && \
    ./configure --enable-shared && \
    make && \
    make install && \
    ldconfig && \
\
# AviSynthPlus
\
    cd /tmp/ && \
    git clone --depth 1 git://github.com/AviSynth/AviSynthPlus.git && \
    cd AviSynthPlus && \
    mkdir avisynth-build && \
    cd avisynth-build && \
    cmake -DCMAKE_CXX_FLAGS=-latomic ../ -G Ninja && \
    ninja && \
    ninja install

# FFmpeg
RUN set -xe && \
    cd /tmp/ && \
    git clone --depth 1 https://github.com/FFmpeg/FFmpeg.git -b release/4.4 && \
    cd FFmpeg && \
    ./configure --enable-version3 --extra-ldflags="-latomic" --extra-cflags="-I/usr/local/include" --extra-ldflags="-L/usr/local/lib" --arch=aarch64 --target-os=linux --enable-gpl --disable-doc --disable-debug --enable-pic --enable-avisynth --enable-libx264 --enable-libx265 --enable-libaribb24 --enable-libass --enable-libfdk-aac --enable-libfreetype --enable-libmp3lame --enable-libopus --enable-libvorbis --enable-libvpx --enable-nonfree --extra-libs=-ldl --disable-x86asm && \
    make -j4 && \
    make install && \
\
# L-SMASH-Works
\
    cd /tmp/ && \
    git clone https://github.com/HolyWu/L-SMASH-Works.git && \
    cd /tmp/ && \
    git clone https://github.com/tobitti0/chapter_exe.git -b arm-test && \
    cp chapter_exe/src/sse2neon.h L-SMASH-Works/AviSynth/emmintrin.h && \
    cd L-SMASH-Works/AviSynth && \
    sed -i.bk -e '42,43d' -e "72aif host_machine.cpu_family().startswith('arm')\n add_project_arguments('-mfpu=neon', language : ['c', 'cpp'])\nendif\n" meson.build && \
    sed -i.bk '54d' video_output.cpp && \
    CC=gcc CXX=gcc LD=gcc LDFLAGS="-Wl,-Bsymbolic,-L/opt/vc/lib" meson build && \
    cd build && \
    ninja -v && \
    ninja install && \
    ldconfig && \
\
# JoinLogoScpTrialSetLinux
\
    cd /tmp/ && \
    git clone --recursive https://github.com/tobitti0/JoinLogoScpTrialSetLinux.git && \
    cd JoinLogoScpTrialSetLinux/modules/logoframe/src && \
    make && \
    cd /tmp/ && \
    cp JoinLogoScpTrialSetLinux/modules/logoframe/src/logoframe JoinLogoScpTrialSetLinux/modules/join_logo_scp_trial/bin/logoframe && \
    cd JoinLogoScpTrialSetLinux/modules/join_logo_scp/src && \
    make && \
    cd /tmp/ && \
    cp JoinLogoScpTrialSetLinux/modules/join_logo_scp/src/join_logo_scp JoinLogoScpTrialSetLinux/modules/join_logo_scp_trial/bin/join_logo_scp && \
    cd chapter_exe/src && \
    sed -i.bk -e '5d' Makefile && \
    sed -i.bk -e '5aCFLAGS = -O3 -I/usr/local/include/avisynth -ffast-math -Wall -Wshadow -Wempty-body -I. -std=gnu99 -fpermissive -fomit-frame-pointer -s -fno-tree-vectorize\n' Makefile && \
    make && \
    cd /tmp/ && \
    cp chapter_exe/src/chapter_exe JoinLogoScpTrialSetLinux/modules/join_logo_scp_trial/bin/chapter_exe && \
    mv /tmp/JoinLogoScpTrialSetLinux/modules/join_logo_scp_trial /join_logo_scp_trial  && \
    cd /join_logo_scp_trial && \
\
# Logo Create
\
#    cp -r /mnt/nas/others/logo .  && \
\
# jlse
\
    npm install && \
    npm link && \
    jlse --help && \
\
# delogo
\
    cd /tmp && \
    git clone https://github.com/tobitti0/delogo-AviSynthPlus-Linux.git && \
    cd delogo-AviSynthPlus-Linux/src && \
    make && \
    cp libdelogo.so /join_logo_scp_trial && \
RUN apt-get update && \
    apt-get -y install $DEV && \
    apt-get -y install yasm libx264-dev libmp3lame-dev libopus-dev libvpx-dev && \
    apt-get -y install libx265-dev libnuma-dev && \
    apt-get -y install libasound2 libass9 libvdpau1 libva-x11-2 libva-drm2 libxcb-shm0 libxcb-xfixes0 libxcb-shape0 libvorbisenc2 libtheora0 libaribb24-dev && \
\
#ffmpeg build
    mkdir /tmp/ffmpeg_sources && \
    cd /tmp/ffmpeg_sources && \
    curl -fsSL http://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.bz2 | tar -xj --strip-components=1 && \
    ./configure \
      --prefix=/usr/local \
      --disable-shared \
      --pkg-config-flags=--static \
      --enable-gpl \
      --enable-libass \
      --enable-libfreetype \
      --enable-libmp3lame \
      --enable-libopus \
      --enable-libtheora \
      --enable-libvorbis \
      --enable-libvpx \
      --enable-libx264 \
      --enable-libx265 \
      --enable-version3 \
      --enable-libaribb24 \
      --enable-nonfree \
      --disable-debug \
      --disable-doc \
    && \
    make -j$(nproc) && \
    make install && \
\
# 不要なパッケージを削除
    apt-get -y remove $DEV && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp
    rm -rf /tmp/*
