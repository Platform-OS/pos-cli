#!/usr/bin/env node
import { program } from '../lib/program.js';

program
  .name('pos-cli ai')
  .command('init', 'register platformOS MCP servers in your AI tool configuration')
  .parse(process.argv);
