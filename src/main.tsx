import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from './page';
import {About} from '@/components/about';
import './globals.css';

/** Tiny hash router: `#about` shows the About me page, anything else the forecast page. */
function App(){
 const [page,setPage]=useState(()=>location.hash==='#about'?'about':'home');
 useEffect(()=>{const on=()=>setPage(location.hash==='#about'?'about':'home');window.addEventListener('hashchange',on);return()=>window.removeEventListener('hashchange',on);},[]);
 return page==='about'?<About/>:<Home/>;
}
createRoot(document.getElementById('root')!).render(<App/>);
