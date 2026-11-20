'use client';

import React from 'react';

export interface FeedSkeletonProps {
  isDusk: boolean;
}

export default function FeedSkeleton({ isDusk }: FeedSkeletonProps) {
  return (
    <div className="space-y-3.5">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`rounded-3xl p-5 space-y-3 animate-pulse shadow-xs border ${
            isDusk
              ? 'bg-[#2A263A] border-[#3E3852]'
              : 'bg-[#EDE8DF] border-[#D2C9B8]'
          }`}
        >
          <div className="flex justify-between items-center">
            <div
              className={`w-28 h-6 rounded-full ${
                isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
              }`}
            />
            <div
              className={`w-12 h-4 rounded ${
                isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
              }`}
            />
          </div>
          <div
            className={`w-4/5 h-5 rounded-lg ${
              isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
            }`}
          />
          <div className="space-y-1.5">
            <div
              className={`w-full h-3.5 rounded ${
                isDusk ? 'bg-[#3E3852]/70' : 'bg-[#DCD5C9]/70'
              }`}
            />
            <div
              className={`w-5/6 h-3.5 rounded ${
                isDusk ? 'bg-[#3E3852]/70' : 'bg-[#DCD5C9]/70'
              }`}
            />
          </div>
          <div
            className={`h-16 rounded-2xl ${
              isDusk ? 'bg-[#161320]' : 'bg-[#E5DFD3]'
            }`}
          />
          <div
            className={`flex justify-between pt-2 border-t ${
              isDusk ? 'border-[#3E3852]' : 'border-[#D2C9B8]'
            }`}
          >
            <div
              className={`w-16 h-7 rounded-xl ${
                isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
              }`}
            />
            <div
              className={`w-20 h-7 rounded-xl ${
                isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
              }`}
            />
            <div
              className={`w-16 h-7 rounded-xl ${
                isDusk ? 'bg-[#3E3852]' : 'bg-[#DCD5C9]'
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
