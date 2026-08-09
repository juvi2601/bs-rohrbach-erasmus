(function(){
  if(!window.CMS || !window.React) return;
  const h=React.createElement;
  class ApprovedMediaListControl extends React.Component{
    constructor(props){super(props);this.state={items:[],loading:true,error:''};}
    componentDidMount(){fetch('/api/media/gallery',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Galerie konnte nicht geladen werden.');return r.json()}).then(d=>this.setState({items:(d.items||[]).filter(x=>x.mediaType==='image'),loading:false})).catch(e=>this.setState({error:e.message,loading:false}));}
    values(){const v=this.props.value;return v&&typeof v.toJS==='function'?v.toJS():(Array.isArray(v)?v:[]);}
    toggle(url){let v=this.values();v=v.includes(url)?v.filter(x=>x!==url):v.concat(url);this.props.onChange(v);}
    render(){const selected=this.values();if(this.state.loading)return h('div',{className:'approved-media-status'},'Freigegebene Fotos werden geladen …');if(this.state.error)return h('div',{className:'approved-media-error'},this.state.error);
      return h('div',{className:'approved-media-widget'},
        h('div',{className:'approved-media-head'},h('strong',null,'Freigegebene Fotos auswählen'),h('span',null,selected.length+' ausgewählt')),
        this.state.items.length?h('div',{className:'approved-media-grid'},this.state.items.map(item=>{const on=selected.includes(item.image);return h('button',{type:'button',key:item.id,className:'approved-media-item'+(on?' selected':''),onClick:()=>this.toggle(item.image),'aria-pressed':on},h('img',{src:item.image,alt:item.alt||item.title||'Freigegebenes Foto'}),h('span',null,on?'✓ Ausgewählt':(item.day||item.title||'Foto')))})):h('p',null,'Noch keine freigegebenen Fotos vorhanden.')
      );
    }
  }
  const Preview=props=>{const v=props.value&&typeof props.value.toJS==='function'?props.value.toJS():(props.value||[]);return h('div',null,(v||[]).map((src,i)=>h('img',{key:i,src,style:{maxWidth:'160px',margin:'4px'}})));};
  CMS.registerWidget('approved_media_list',ApprovedMediaListControl,Preview);
})();
