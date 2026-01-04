interface IProps {
  click: (item: string) => void,
}

const hintList = [
  '一年中几月份最好找工作？',
  '古人如何描写遗憾？',
  '哪些习惯能提升睡眠质量？',
  '为什么唐宋八大家没有李白？',
  '写一份简洁清晰的工作周报',
  '生成小众艺术插画',
  '电子设备的护眼模式真的能防近视吗？',
  '写一份结构严谨的论文大纲',
]

export default function HintList(props: IProps) {

  const clickHint = (item: string) => {
    props.click(item)
  }

  return (
    <>
      {
        new Array(3).fill(12).map((_item, fatherIndex) => (
          <div
            key={fatherIndex}
            className={'flex items-center gap-x-2'}
          >
            {
              hintList.slice(3*(fatherIndex), 3*(fatherIndex+1)).map((item, index) => (
                <div
                  key={index}
                  className={'bg-[#0000000a] hover:bg-[#00000012] flex justify-center items-center px-4 py-2.5 rounded-xl cursor-pointer'}
                  onClick={() => clickHint(item)}
                >
                  <span className="text-sm">{item}</span>
                </div>
              ))
            }
          </div>
        ))
      }
    </>
  )
}